// frontend/src/components/InterviewRoom.js

import React, { useRef, useState, useEffect, useCallback } from 'react';
import io from 'socket.io-client';
import Peer from 'simple-peer';

const SIGNALING_SERVER_URL = import.meta.env.VITE_SIGNALING_SERVER_URL;

function InterviewRoom({ 
    selectedCandidate, 
    selectedJob, 
    roomId, 
    userRole, 
    onTranscriptUpdate, 
    onInterviewAnalysisTrigger 
}) {
    // Video refs
    const localVideoRef = useRef();
    const remoteVideoRefs = useRef({}); // Stores refs for multiple remote videos: {socketId: videoElement}
    const remoteVideoContainerRef = useRef(); // Container to append remote video elements

    // WebRTC and Socket.IO
    const socketRef = useRef();
    const peersRef = useRef({}); // Stores Peer objects: {socketId: PeerInstance}
    const localStreamRef = useRef(null); // Stores local camera/mic stream

    // ASR State
    const recognitionRef = useRef(null); // Web Speech API SpeechRecognition
    const fullTranscriptRef = useRef(""); // Accumulates full transcript for analysis
    const [isRecordingASR, setIsRecordingASR] = useState(false);
    const [liveTranscript, setLiveTranscript] = useState(""); // For live display during ASR
    const [asrStatus, setAsrStatus] = useState("Idle");

    // UI State
    const [message, setMessage] = useState("");
    const [remoteParticipants, setRemoteParticipants] = useState({}); // {socketId: {peerId: string}}

    // --- WebRTC Logic ---
    useEffect(() => {
        // Initialize Socket.IO connection
        socketRef.current = io(SIGNALING_SERVER_URL);

        // Get local media stream (camera and microphone)
        navigator.mediaDevices.getUserMedia({ video: true, audio: true })
            .then(stream => {
                localStreamRef.current = stream;
                if (localVideoRef.current) {
                    localVideoRef.current.srcObject = stream;
                }
                setMessage("Local camera and microphone stream ready.");

                // Emit 'join-room' to signaling server
                socketRef.current.emit('join-room', roomId, socketRef.current.id);

                // --- Signaling Events ---
                socketRef.current.on('existing-users', (userIds) => {
                    // Create an offer for each existing user in the room
                    userIds.forEach(userId => {
                        const peer = createPeer(userId, stream, true); // Initiator
                        peersRef.current[userId] = peer;
                    });
                });

                socketRef.current.on('user-joined', (userId) => {
                    // Create a peer connection for the new user (not initiator)
                    const peer = createPeer(userId, stream, false); // Not initiator
                    peersRef.current[userId] = peer;
                    setMessage(`User ${userId.substring(0, 6)} joined the room.`);
                });

                socketRef.current.on('signal', ({ from, signal }) => {
                    const peer = peersRef.current[from];
                    if (peer) {
                        peer.signal(signal);
                    }
                });

                socketRef.current.on('user-left', (userId) => {
                    if (peersRef.current[userId]) {
                        peersRef.current[userId].destroy();
                        delete peersRef.current[userId];
                        setMessage(`User ${userId.substring(0, 6)} left the room.`);
                        // Remove remote video element
                        const remoteVideoDiv = document.getElementById(`remote-video-${userId}`);
                        if (remoteVideoDiv) remoteVideoDiv.remove();
                    }
                });
            })
            .catch(error => {
                console.error('Error accessing media devices:', error);
                setMessage('Error accessing camera/microphone. Please ensure permissions are granted.');
            });

        // Cleanup function for useEffect
        return () => {
            if (socketRef.current) socketRef.current.disconnect();
            if (localStreamRef.current) {
                localStreamRef.current.getTracks().forEach(track => track.stop());
            }
            Object.values(peersRef.current).forEach(peer => peer.destroy());
            peersRef.current = {};
            stopASR(); // Stop ASR if it was running
        };
    }, [roomId]); // Dependency on roomId ensures setup when room changes

    // Helper to create a SimplePeer instance
    const createPeer = (userId, stream, initiator) => {
        const peer = new Peer({
            initiator,
            trickle: false, // Set to true for more efficient signaling, but more complex server
            stream,
        });

        peer.on('signal', (signal) => {
            // Send signaling data to the other peer via the signaling server
            socketRef.current.emit('signal', { to: userId, signal });
        });

        peer.on('stream', (remoteStream) => {
            // When a remote stream is received, create/update the remote video element
            let videoElement = remoteVideoRefs.current[userId];
            if (!videoElement) {
                // Create container div for remote video
                const remoteDiv = document.createElement('div');
                remoteDiv.id = `remote-video-${userId}`;
                remoteDiv.className = 'remote-video-tile';
                const pTag = document.createElement('p');
                pTag.innerText = `Participant: ${userId.substring(0, 6)}`;
                
                videoElement = document.createElement('video');
                videoElement.autoplay = true;
                videoElement.playsInline = true; // For iOS compatibility
                videoElement.muted = false; // Remote audio should NOT be muted
                
                remoteDiv.appendChild(pTag);
                remoteDiv.appendChild(videoElement);
                remoteVideoContainerRef.current.appendChild(remoteDiv);
                remoteVideoRefs.current[userId] = videoElement;
            }
            videoElement.srcObject = remoteStream;
            setMessage(`Received stream from ${userId.substring(0, 6)}`);
        });

        peer.on('close', () => {
            console.log(`Peer connection closed for ${userId}`);
            if (peersRef.current[userId]) {
                peersRef.current[userId].destroy();
                delete peersRef.current[userId];
                const remoteVideoDiv = document.getElementById(`remote-video-${userId}`);
                if (remoteVideoDiv) remoteVideoDiv.remove();
            }
        });

        peer.on('error', (err) => {
            console.error('Peer error:', err);
            setMessage(`Peer error with ${userId.substring(0, 6)}: ${err.message}`);
        });

        return peer;
    };

    // --- ASR Logic (Only for Interviewee) ---
    const startASR = () => {
        if (userRole !== 'interviewee') {
            setMessage("ASR is only enabled for the Interviewee role.");
            return;
        }

        if (!('webkitSpeechRecognition' in window)) {
            setMessage("Web Speech API is not supported in this browser. Please use Chrome for ASR.");
            return;
        }
        if (isRecordingASR) return; // Already recording

        const SpeechRecognition = window.webkitSpeechRecognition;
        recognitionRef.current = new SpeechRecognition();
        recognitionRef.current.continuous = true;
        recognitionRef.current.interimResults = true;
        recognitionRef.current.lang = 'en-US'; // Set language

        recognitionRef.current.onstart = () => {
            setIsRecordingASR(true);
            setAsrStatus("Listening...");
            fullTranscriptRef.current = ""; // Reset transcript for new session
            setLiveTranscript("");
            setMessage("ASR recording started. Speak clearly now.");
        };

        recognitionRef.current.onresult = (event) => {
            let interimTranscript = '';
            let finalTranscript = '';

            for (let i = event.resultIndex; i < event.results.length; ++i) {
                if (event.results[i].isFinal) {
                    finalTranscript += event.results[i][0].transcript + ' ';
                } else {
                    interimTranscript += event.results[i][0].transcript;
                }
            }
            // Update live display
            setLiveTranscript(finalTranscript + interimTranscript);
            // Accumulate final transcript
            fullTranscriptRef.current += finalTranscript;
            // Optionally, send transcript updates to parent for real-time analysis if needed
            // onTranscriptUpdate(fullTranscriptRef.current);
        };

        recognitionRef.current.onerror = (event) => {
            console.error("SpeechRecognition Error:", event.error);
            setAsrStatus(`Error: ${event.error}`);
            setMessage(`ASR Error: ${event.error}. Please try again.`);
            setIsRecordingASR(false);
        };

        recognitionRef.current.onend = () => {
            setIsRecordingASR(false);
            setAsrStatus("Stopped");
            setMessage("ASR recording ended.");
            // Ensure final transcript is captured on stop/end
            if (liveTranscript && !fullTranscriptRef.current.includes(liveTranscript)) {
                fullTranscriptRef.current += liveTranscript;
            }
            setLiveTranscript(""); // Clear live display
            // Send the full transcript to the parent component for final analysis trigger
            if (onTranscriptUpdate) {
                onTranscriptUpdate(fullTranscriptRef.current);
            }
        };

        recognitionRef.current.start();
    };

    const stopASR = () => {
        if (recognitionRef.current) {
            recognitionRef.current.stop();
            setIsRecordingASR(false);
            setAsrStatus("Stopping...");
        }
    };

    const triggerFinalAnalysis = () => {
        if (!fullTranscriptRef.current.trim()) {
            setMessage("No interview transcript available to analyze.");
            return;
        }
        if (!selectedCandidate || !selectedJob) {
            setMessage("Candidate or Job not selected. Please go back to setup.");
            return;
        }
        setMessage("Triggering interview analysis...");
        // Call the callback provided by App.js
        onInterviewAnalysisTrigger(selectedCandidate.id, selectedJob.id, fullTranscriptRef.current);
    };

    // --- Call Controls (can be moved to a separate component if complex) ---
    const toggleMic = () => {
        if (localStreamRef.current) {
            localStreamRef.current.getAudioTracks().forEach(track => (track.enabled = !track.enabled));
            setMessage(`Microphone ${localStreamRef.current.getAudioTracks()[0].enabled ? 'on' : 'off'}.`);
        }
    };

    const toggleCamera = () => {
        if (localStreamRef.current) {
            localStreamRef.current.getVideoTracks().forEach(track => (track.enabled = !track.enabled));
            setMessage(`Camera ${localStreamRef.current.getVideoTracks()[0].enabled ? 'on' : 'off'}.`);
        }
    };

    const leaveCall = () => {
        if (socketRef.current) socketRef.current.disconnect();
        if (localStreamRef.current) {
            localStreamRef.current.getTracks().forEach(track => track.stop());
        }
        Object.values(peersRef.current).forEach(peer => peer.destroy());
        peersRef.current = {};
        // Signal parent to go back to setup
        if (onInterviewAnalysisTrigger) {
            onInterviewAnalysisTrigger(selectedCandidate.id, selectedJob.id, fullTranscriptRef.current); // Trigger final analysis on leave
        }
        // Or simply:
        // window.location.reload(); // Simple way to reset state
    };


    return (
        <div className="interview-room-container">
            <h2>Interview Room: {roomId}</h2>
            <p>You are the: <strong>{userRole.toUpperCase()}</strong></p>
            <p>Candidate: <strong>{selectedCandidate?.name || 'N/A'}</strong> | Job: <strong>{selectedJob?.title || 'N/A'}</strong></p>
            
            <div className="video-streams">
                <div className="local-video-wrapper">
                    <h3>Your Feed</h3>
                    <video ref={localVideoRef} autoPlay muted playsInline className="local-video" />
                    <div className="video-controls">
                        <button onClick={toggleMic}>Toggle Mic</button>
                        <button onClick={toggleCamera}>Toggle Camera</button>
                        <button onClick={leaveCall} className="leave-call-btn">Leave Call</button>
                    </div>
                </div>

                <div className="remote-videos-wrapper">
                    <h3>Participants' Feeds</h3>
                    <div className="remote-videos-grid" ref={remoteVideoContainerRef}>
                        {/* Remote videos will be appended here by createPeer logic */}
                        {Object.keys(peersRef.current).length === 0 && <p>Waiting for other participants to join...</p>}
                    </div>
                </div>
            </div>

            {/* ASR section (only for interviewee) */}
            {userRole === 'interviewee' && (
                <div className="asr-section">
                    <h3>Interviewee Speech-to-Text (ASR)</h3>
                    <p>Status: <strong>{asrStatus}</strong></p>
                    <div className="asr-controls">
                        {!isRecordingASR ? (
                            <button onClick={startASR} disabled={!localStreamRef.current}>Start ASR</button>
                        ) : (
                            <button onClick={stopASR} className="stop-button">Stop ASR</button>
                        )}
                    </div>
                    <div className="transcript-display">
                        <h4>Transcript:</h4>
                        <p>{fullTranscriptRef.current + liveTranscript}</p>
                    </div>
                </div>
            )}
            
            {/* Analysis Trigger (can be for Interviewer only, or accessible for anyone to trigger post-call) */}
            {userRole === 'interviewer' && ( // Or always show post-call for interviewee to request own feedback
                <div className="analysis-trigger-section">
                    <button 
                        onClick={triggerFinalAnalysis} 
                        disabled={isRecordingASR || !fullTranscriptRef.current.trim() || !selectedCandidate || !selectedJob}
                    >
                        Analyze Interview & Get Report
                    </button>
                    <p className="hint-message">Make sure ASR is stopped and transcript is complete before analyzing.</p>
                </div>
            )}

            <div className="status-messages">
                <h4>System Messages:</h4>
                <p>{message}</p>
            </div>
        </div>
    );
}

export default InterviewRoom;

