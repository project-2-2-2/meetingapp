// frontend/src/components/AnalysisReport.js

import React from 'react';

function AnalysisReport({ report, isLoading, error }) {
    if (isLoading) {
        return <div className="analysis-report-container"><h2>Analyzing Interview...</h2><p>Please wait while the AI processes the transcript and generates the report.</p></div>;
    }

    if (error) {
        return <div className="analysis-report-container error-report"><h2>Analysis Error</h2><p>Error: {error}</p><p>Please check the backend server and ensure Gemini API key is configured correctly.</p></div>;
    }

    if (!report) {
        return <div className="analysis-report-container"><h2>LLM Analysis Report</h2><p>No report generated yet. Start an interview and click "Analyze Interview".</p></div>;
    }

    const getSuitabilityColor = (score) => {
        if (score >= 8) return 'green-score';
        if (score >= 5) return 'orange-score';
        return 'red-score';
    };

    return (
        <div className="analysis-report-container">
            <h2>LLM Analysis Report</h2>
            <div className="report-section">
                <h3>Summary:</h3>
                <p>{report.summary}</p>
            </div>

            <div className="report-section">
                <h3>Suitability Score: 
                    {report.suitability_score !== null && (
                        <span className={`suitability-score ${getSuitabilityColor(report.suitability_score)}`}>
                            {report.suitability_score}/10
                        </span>
                    )}
                </h3>
            </div>

            <div className="report-section">
                <h3>Strengths:</h3>
                {report.strengths && report.strengths.length > 0 ? (
                    <ul>
                        {report.strengths.map((item, index) => <li key={index}>{item}</li>)}
                    </ul>
                ) : (
                    <p>No specific strengths identified.</p>
                )}
            </div>

            <div className="report-section">
                <h3>Weaknesses/Areas for Improvement:</h3>
                {report.weaknesses && report.weaknesses.length > 0 ? (
                    <ul>
                        {report.weaknesses.map((item, index) => <li key={index}>{item}</li>)}
                    </ul>
                ) : (
                    <p>No specific weaknesses identified.</p>
                )}
            </div>

            <div className="report-section">
                <h3>Potential Red Flags/Inconsistencies:</h3>
                {report.red_flags && report.red_flags.length > 0 ? (
                    <ul>
                        {report.red_flags.map((item, index) => <li key={index}>{item}</li>)}
                    </ul>
                ) : (
                    <p>No significant red flags or inconsistencies identified.</p>
                )}
            </div>
            
            <div className="report-section">
                <h3>Recommendations:</h3>
                {report.recommendations && report.recommendations.length > 0 ? (
                    <ul>
                        {report.recommendations.map((item, index) => <li key={index}>{item}</li>)}
                    </ul>
                ) : (
                    <p>No specific recommendations provided.</p>
                )}
            </div>
        </div>
    );
}

export default AnalysisReport;
