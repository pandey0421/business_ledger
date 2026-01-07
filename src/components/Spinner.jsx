import React from 'react';

const Spinner = ({ size = 40, color = "#42a5f5" }) => {
    return (
        <div style={{ display: 'inline-block' }} aria-label="Loading">
            <svg
                width={size}
                height={size}
                viewBox="0 0 50 50"
                xmlns="http://www.w3.org/2000/svg"
                style={{ animation: 'spin 1s linear infinite' }}
            >
                <circle
                    cx="25"
                    cy="25"
                    r="20"
                    fill="none"
                    stroke="#e0e0e0"
                    strokeWidth="4"
                />
                <circle
                    cx="25"
                    cy="25"
                    r="20"
                    fill="none"
                    stroke={color}
                    strokeWidth="4"
                    strokeDasharray="80"
                    strokeDashoffset="60"
                />
            </svg>
            <style>{`
        @keyframes spin {
          100% { transform: rotate(360deg); }
        }
      `}</style>
        </div>
    );
};

export default Spinner;
