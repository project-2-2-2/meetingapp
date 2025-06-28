// frontend/src/services/apiService.js

import axios from 'axios';

const BACKEND_API_URL = import.meta.env.VITE_BACKEND_API_URL || 'http://localhost:8000';

const api = axios.create({
    baseURL: BACKEND_API_URL,
    headers: {
        'Content-Type': 'application/json',
    },
});

/**
 * Fetches available candidate resumes and job descriptions from the backend.
 * @returns {Promise<Object>} An object containing lists of candidates and jobs.
 */
export const getAvailableDocuments = async () => {
    try {
        const response = await api.get('/get-available-documents');
        return response.data;
    } catch (error) {
        console.error("Error fetching available documents:", error);
        throw error;
    }
};

/**
 * Sends interview transcript and context for LLM analysis.
 * @param {string} candidateId - The ID of the selected candidate.
 * @param {string} jobId - The ID of the selected job.
 * @param {string} transcript - The full interview transcript.
 * @returns {Promise<Object>} The LLM's analysis report.
 */
export const analyzeInterview = async (candidateId, jobId, transcript) => {
    try {
        const response = await api.post('/analyze-interview', {
            candidate_id: candidateId,
            job_id: jobId,
            interview_transcript: transcript, // <-- CHANGED THIS LINE
        });
        return response.data;
    } catch (error) {
        console.error("Error analyzing interview:", error);
        throw error;
    }
};

