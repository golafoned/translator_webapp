import React from "react";

type Language = { code: string; name: string; flag: string };

interface LanguageSelectorProps {
    selectedLang: string;
    onChange: (langCode: string) => void;
    disabled?: boolean;
    languages: Language[];
    defaultLabel?: string;
}

const LanguageSelector: React.FC<LanguageSelectorProps> = ({
    selectedLang,
    onChange,
    disabled = false,
    languages,
    defaultLabel = "Select Language",
}) => (
    <select
        value={selectedLang}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className="px-2 py-1 rounded border outline-none transition-colors
            bg-[var(--input-bg-color)] text-[var(--input-text-color)]
            placeholder-[var(--input-placeholder-color)]
            border-[var(--border-color)]
            focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        style={{
            minWidth: 120,
            // fallback for browsers not supporting CSS vars
            backgroundColor: "var(--input-bg-color)",
            color: "var(--input-text-color)",
            borderColor: "var(--border-color)",
        }}
    >
        <option value="" disabled>
            {defaultLabel}
        </option>
        {languages.map((lang) => (
            <option key={lang.code} value={lang.code}>
                {lang.flag} {lang.name}
            </option>
        ))}
    </select>
);

export default LanguageSelector;
