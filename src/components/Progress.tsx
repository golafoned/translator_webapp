import React from "react";

interface ProgressProps {
    percentage?: number;
}

const Progress: React.FC<ProgressProps> = ({ percentage = 0 }) => {
    return (
        <div className="w-full h-3 bg-[var(--input-bg-color)] rounded-full overflow-hidden border border-[var(--border-color)]">
            <div
                className="h-full transition-all duration-300"
                style={{
                    width: `${percentage}%`,
                    backgroundColor: "green",
                }}
            />
        </div>
    );
};

export default Progress;
