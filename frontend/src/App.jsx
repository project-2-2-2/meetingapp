// frontend/src/App.js

import React, { useState, useEffect, useCallback } from 'react';
import InterviewRoom from './components/InterviewRoom';
import AnalysisReport from './components/AnalysisReport';
import * as apiService from './services/apiService';
import './App.css'; // Global styling

function App() {
    const [availableDocs, setAvailableDocs] = useState({ candidates: [], jobs: [] });
    const [selectedCandidate, setSelectedCandidate] = useState(null);
    const [selectedJob, setSelectedJob] = useState(null);
    const [roomId, setRoomId] = useState('');
    const [userRole, setUserRole] = useState(''); // 'interviewer' or 'interviewee'
    const [inInterview, setInInterview] = useState(false); // Controls view: Setup vs. Interview
const [currentPage, setCurrentPage] = useState('main'); // 'main' or 'abc'

    const [interviewTranscript, setInterviewTranscript] = useState(""); // Accumulates transcript from InterviewRoom
    const [llmReport, setLlmReport] = useState(null);
    const [isLoadingReport, setIsLoadingReport] = useState(false);
    const [reportError, setReportError] = useState(null);

    // Fetch available documents on component mount
    useEffect(() => {
        const fetchDocs = async () => {
            try {
                const docs = await apiService.getAvailableDocuments();
                setAvailableDocs(docs);
                // Set first available candidate/job as default for convenience
                if (docs.candidates.length > 0) {
                    setSelectedCandidate(docs.candidates[0]);
                }
                if (docs.jobs.length > 0) {
                    setSelectedJob(docs.jobs[0]);
                }
            } catch (error) {
                console.error("Failed to fetch available documents:", error);
                // Handle error (e.g., show message to user)
            }
        };
        fetchDocs();
    }, []);

    // Callback from InterviewRoom to update transcript
    const handleTranscriptUpdate = useCallback((transcript) => {
        setInterviewTranscript(transcript);
        console.log("App.js received transcript update:", transcript.substring(0, 50) + "...");
    }, []);

    // Callback from InterviewRoom to trigger analysis
    const handleInterviewAnalysisTrigger = useCallback(async (candidateId, jobId, transcript) => {
        setIsLoadingReport(true);
        setReportError(null);
        setLlmReport(null); // Clear previous report

        try {
            console.log("App.js triggering analysis with transcript:", transcript.substring(0, 100) + "...");
            const report = await apiService.analyzeInterview(candidateId, jobId, transcript);
            setLlmReport(report);
            console.log("LLM Report received:", report);
        } catch (error) {
            console.error("Error analyzing interview:", error);
            setReportError(error.message || "An unknown error occurred during analysis.");
        } finally {
            setIsLoadingReport(false);
            // After analysis, maybe go back to setup or show report
            // For this version, we will stay in interview room to see report
            // If interviewer leaves, they should still see report
        }
    }, []);

    const handleJoinInterview = () => {
        if (roomId.trim() && userRole && selectedCandidate && selectedJob) {
            setInInterview(true);
        } else {
            alert("Please fill in Room ID, select a role, candidate, and job.");
        }
    };
const abc = () => {
   <abc
                            selectedCandidate={selectedCandidate}
                            selectedJob={selectedJob}
                            roomId={roomId}
                            userRole={userRole}
                            onTranscriptUpdate={handleTranscriptUpdate}
                            onInterviewAnalysisTrigger={handleInterviewAnalysisTrigger}
                        />    }
    const handleLeaveInterview = () => {
        setInInterview(false);
        setInterviewTranscript(""); // Reset transcript
        setLlmReport(null);
        setIsLoadingReport(false);
        setReportError(null);
        // Do not reset room ID, candidate, job so user can rejoin/re-select
    };

    return (
        <div className="App">
            
            <h1>AI Interview Detector</h1>
              {!inInterview ? (
                <div className="setup-section">
                    <h2>Setup Interview Session</h2>

                    <div className="dropdown-group">
                        <label htmlFor="candidate-select">Select Candidate:</label>
                        <select
                            id="candidate-select"
                            value={selectedCandidate ? selectedCandidate.id : ''}
                            onChange={(e) => {
                                const selected = availableDocs.candidates.find(c => c.id === e.target.value);
                                setSelectedCandidate(selected);
                            }}
                        >
                            <option value="">--Select Candidate--</option>
                            {availableDocs.candidates.map(candidate => (
                                <option key={candidate.id} value={candidate.id}>
                                    {candidate.name}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div className="dropdown-group">
                        <label htmlFor="job-select">Select Job Description:</label>
                        <select
                            id="job-select"
                            value={selectedJob ? selectedJob.id : ''}
                            onChange={(e) => {
                                const selected = availableDocs.jobs.find(j => j.id === e.target.value);
                                setSelectedJob(selected);
                            }}
                        >
                            <option value="">--Select Job--</option>
                            {availableDocs.jobs.map(job => (
                                <option key={job.id} value={job.id}>
                                    {job.title}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div className="input-group">
                        <label htmlFor="room-id">Enter Room ID:</label>
                        <input
                            id="room-id"
                            type="text"
                            placeholder="e.g., my-interview-room"
                            value={roomId}
                            onChange={(e) => setRoomId(e.target.value)}
                        />
                    </div>

                    <div className="role-selection">
                        <label>Select Your Role:</label>
                        <div className="role-buttons">
                            <button
                                className={userRole === 'interviewer' ? 'active' : ''}
                                onClick={() => setUserRole('interviewer')}
                            >
                                Interviewer
                            </button>
                            <button
                                className={userRole === 'interviewee' ? 'active' : ''}
                                onClick={() => setUserRole('interviewee')}
                            >
                                Interviewee
                            </button>
                        </div>
                    </div>

                    <button
                        onClick={handleJoinInterview}
                        disabled={!roomId.trim() || !userRole || !selectedCandidate || !selectedJob}
                    >
                        Join Interview
                    </button>
                    {!roomId.trim() || !userRole || !selectedCandidate || !selectedJob ? (
                        <p className="warning-message">Please fill all fields to join the interview.</p>
                    ) : null}

                </div>
            ) : (
                <div className="interview-session">
                    <button className="leave-interview-btn" onClick={handleLeaveInterview}>Leave Interview</button>
                    <div className="interview-layout">
                        <InterviewRoom
                            selectedCandidate={selectedCandidate}
                            selectedJob={selectedJob}
                            roomId={roomId}
                            userRole={userRole}
                            onTranscriptUpdate={handleTranscriptUpdate}
                            onInterviewAnalysisTrigger={handleInterviewAnalysisTrigger}
                        />
                        {/* Only show AnalysisReport if role is interviewer OR if report is available (post-call) */}
                        {(userRole === 'interviewer' || llmReport) && (
                             <AnalysisReport
                                report={llmReport}
                                isLoading={isLoadingReport}
                                error={reportError}
                            />
                        )}
                       
                    </div>
                </div>
            )}
        </div>
    );
}

export default App;
