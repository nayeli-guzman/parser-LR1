import React from "react";

export const Pill = ({
  children,
  tone = "gray",
}: {
  children: React.ReactNode;
  tone?: "gray" | "blue" | "green" | "purple";
}) => {
  const tones: Record<string, string> = {
    gray:   "bg-gray-50 text-gray-700 border-gray-200",
    blue:   "bg-blue-50 text-blue-700 border-blue-200",
    green:  "bg-emerald-50 text-emerald-700 border-emerald-200",
    purple: "bg-fuchsia-50 text-fuchsia-700 border-fuchsia-200",
  };
  return (
    <span className={`px-2 py-1 rounded-full text-xs border ${tones[tone]}`}>
      {children}
    </span>
  );
};

export const Btn = ({
  children,
  onClick,
  variant = "solid",
  disabled,
  title,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  variant?: "solid" | "ghost" | "outline";
  disabled?: boolean;
  title?: string;
}) => {
  const base =
    "inline-flex items-center gap-2 px-3 py-2 rounded-xl text-sm transition";
  const styles =
    variant === "solid"
      ? "bg-neutral-900 text-white hover:opacity-90"
      : variant === "ghost"
      ? "border border-neutral-200 hover:bg-neutral-50"
      : "border border-neutral-300 hover:bg-neutral-50";
  return (
    <button
      title={title}
      onClick={onClick}
      disabled={disabled}
      className={`${base} ${styles} disabled:opacity-50 disabled:cursor-not-allowed`}
    >
      {children}
    </button>
  );
};

export const SectionHeader = ({
  icon: Icon,
  title,
  subtitle,
  right,
}: {
  icon: React.ComponentType<any>;
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
}) => (
  <div className="flex items-start justify-between mb-3">
    <div>
      <div className="flex items-center gap-2">
        <Icon className="w-5 h-5" />
        <h2 className="text-lg font-semibold">{title}</h2>
      </div>
      {subtitle && <p className="text-sm text-gray-500 mt-0.5">{subtitle}</p>}
    </div>
    {right}
  </div>
);
