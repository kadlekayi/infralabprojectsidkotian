import * as React from "react";

/**
 * Government of Karnataka office desk components.
 * Vidhana Soudha aesthetic: wood, paper, brass, official seals.
 */

/** The Government of Karnataka masthead — appears at the top of official documents */
export const GovtMasthead = ({ subtitle }: { subtitle?: string }) => (
  <div className="govt-masthead rounded-t-lg">
    <div className="emblem">🏛️</div>
    <div className="title">Government of Karnataka</div>
    <div className="subtitle">ವidhಾನEARCH苏 raisons • Vidhana Soudha, Bengaluru</div>
    {subtitle && (
      <div className="mt-2 text-xs font-semibold text-red-800 uppercase tracking-widest border-t border-b border-amber-700/30 py-1">
        {subtitle}
      </div>
    )}
  </div>
);

/** A nameplate for the Finance Minister's desk */
export const Nameplate = ({ name, designation }: { name: string; designation: string }) => (
  <div className="flex flex-col items-center gap-1">
    <div className="nameplate text-sm">{name}</div>
    <div className="text-[10px] uppercase tracking-widest text-amber-200/70 font-serif">{designation}</div>
  </div>
);

/** An official document card with letterhead styling */
export const OfficialDoc = ({
  children,
  fileNo,
  date,
  className = "",
  confidential = false,
}: {
  children: React.ReactNode;
  fileNo?: string;
  date?: string;
  className?: string;
  confidential?: boolean;
}) => (
  <div className={`doc-card ${className}`}>
    <div className="paper-clip" />
    <div className="flex justify-between items-start mb-4 pb-3 border-b border-amber-900/20">
      <div>
        {fileNo && <span className="file-number">File No: {fileNo}</span>}
      </div>
      <div className="flex items-center gap-3">
        {confidential && <span className="confidential-stamp">Confidential</span>}
        {date && <span className="text-xs text-amber-900/60 font-serif">{date}</span>}
      </div>
    </div>
    {children}
    <div className="mt-4 pt-3 border-t border-amber-900/20 flex justify-between items-center">
      <span className="text-[10px] text-amber-900/50 font-serif uppercase tracking-wider">
        Finance Department • Government of Karnataka
      </span>
      <div className="official-seal w-12 h-12 text-[8px]">
        <span className="relative z-10">Govt<br/>of<br/>Karnataka</span>
      </div>
    </div>
  </div>
);

/** A file folder tab for organizing sections */
export const FileFolderTab = ({
  label,
  active = false,
  onClick,
}: {
  label: string;
  active?: boolean;
  onClick?: () => void;
}) => (
  <button
    onClick={onClick}
    className={`file-folder text-sm font-serif transition-all ${
      active
        ? "bg-amber-700 text-amber-50 shadow-lg translate-y-0"
        : "bg-amber-600/80 text-amber-100 hover:bg-amber-600 translate-y-1"
    }`}
  >
    <span className="relative z-10">📁 {label}</span>
  </button>
);

/** A rubber stamp effect for approvals/rejections */
export const RubberStamp = ({
  text,
  type = "approved",
  size = "md",
}: {
  text: string;
  type?: "approved" | "rejected" | "pending" | "noted";
  size?: "sm" | "md" | "lg";
}) => {
  const colors = {
    approved: "border-emerald-700 text-emerald-700",
    rejected: "border-red-800 text-red-800",
    pending: "border-amber-700 text-amber-700",
    noted: "border-blue-800 text-blue-800",
  };
  const sizes = {
    sm: "w-16 h-16 text-[8px]",
    md: "w-20 h-20 text-[10px]",
    lg: "w-24 h-24 text-xs",
  };
  return (
    <div
      className={`stamp border-2 ${colors[type]} ${sizes[size]} rounded-full flex items-center justify-center font-bold uppercase tracking-wider ${type === "approved" ? "rotate-[-8deg]" : type === "rejected" ? "rotate-[8deg]" : "rotate-[-3deg]"}`}
    >
      <span className="text-center leading-tight">{text}</span>
    </div>
  );
};

/** A wooden desk panel/frame for containing content */
export const DeskPanel = ({
  children,
  title,
  className = "",
}: {
  children: React.ReactNode;
  title?: string;
  className?: string;
}) => (
  <div className={`desk-panel p-6 ${className}`}>
    {title && (
      <div className="mb-4 pb-2 border-b border-amber-200/20">
        <h3 className="text-amber-100 font-serif text-lg tracking-wide">{title}</h3>
      </div>
    )}
    {children}
  </div>
);

/** A brass plaque for important notices */
export const BrassPlaque = ({ children, className = "" }: { children: React.ReactNode; className?: string }) => (
  <div className={`brass-plaque text-center ${className}`}>
    {children}
  </div>
);

/** Paper document with coffee stains and age marks */
export const AgedPaper = ({
  children,
  className = "",
  stains = true,
}: {
  children: React.ReactNode;
  className?: string;
  stains?: boolean;
}) => (
  <div className={`paper-texture text-amber-900 rounded-sm p-6 relative ${className}`}>
    {stains && (
      <>
        <div className="coffee-stain top-4 right-8" />
        <div className="coffee-stain bottom-8 left-12 w-10 h-10" />
      </>
    )}
    <div className="relative z-10">{children}</div>
  </div>
);

/** A typewriter-style text block for official correspondence */
export const TypewriterText = ({ children, className = "" }: { children: React.ReactNode; className?: string }) => (
  <div className={`typewriter text-amber-900 ${className}`}>
    {children}
  </div>
);

/** The Karnataka state flag accent */
export const KarnatakaFlag = ({ className = "" }: { className?: string }) => (
  <div className={`karnataka-accent-bar rounded-full ${className}`} />
);

/** A desk drawer with handle (decorative) */
export const DeskDrawer = ({ label, children }: { label: string; children?: React.ReactNode }) => (
  <div className="bg-gradient-to-b from-amber-900/40 to-amber-950/60 rounded-lg p-4 border border-amber-800/30">
    <div className="flex items-center justify-between mb-3">
      <span className="text-xs uppercase tracking-widest text-amber-200/70 font-serif">{label}</span>
      <div className="drawer-handle" />
    </div>
    {children}
  </div>
);

/** Ink bottle decoration */
export const InkBottle = () => (
  <div className="relative w-8 h-12">
    <div className="absolute bottom-0 w-8 h-8 bg-gradient-to-b from-blue-900 to-blue-950 rounded-sm border border-blue-800" />
    <div className="absolute top-0 left-1/2 -translate-x-1/2 w-3 h-5 bg-amber-900 rounded-t-sm" />
    <div className="absolute top-2 left-1/2 -translate-x-1/2 w-1 h-3 bg-amber-950 rounded-full" />
  </div>
);

/** Pen holder with pens */
export const PenHolder = () => (
  <div className="relative w-10 h-14">
    <div className="absolute bottom-0 left-1 w-2 h-8 bg-red-800 rounded-t-full transform -rotate-12" />
    <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-2 h-10 bg-blue-900 rounded-t-full" />
    <div className="absolute bottom-0 right-1 w-2 h-7 bg-amber-700 rounded-t-full transform rotate-12" />
    <div className="absolute bottom-0 w-10 h-6 bg-gradient-to-b from-amber-800 to-amber-950 rounded-sm border border-amber-700" />
  </div>
);

/** A stack of files/papers */
export const FileStack = ({ count = 3 }: { count?: number }) => (
  <div className="relative">
    {Array.from({ length: count }).map((_, i) => (
      <div
        key={i}
        className="absolute paper-texture w-16 h-20 rounded-sm"
        style={{
          transform: `rotate(${(i - 1) * 5}deg) translate(${(i - 1) * 2}px, ${i * -2}px)`,
          zIndex: count - i,
        }}
      />
    ))}
    <div className="relative paper-texture w-16 h-20 rounded-sm z-10 flex items-center justify-center">
      <span className="text-[8px] text-amber-900/50 font-serif">📄</span>
    </div>
  </div>
);

/** Official signature line */
export const SignatureLine = ({ label }: { label: string }) => (
  <div className="mt-8 pt-2 border-t border-amber-900/30 w-48">
    <div className="text-[10px] text-amber-900/60 font-serif italic">{label}</div>
  </div>
);

/** A wax seal decoration */
export const WaxSeal = ({ color = "red" }: { color?: "red" | "gold" | "green" }) => {
  const colors = {
    red: "from-red-800 to-red-950",
    gold: "from-amber-600 to-amber-800",
    green: "from-emerald-700 to-emerald-900",
  };
  return (
    <div className={`w-10 h-10 rounded-full bg-gradient-to-br ${colors[color]} shadow-lg relative`}>
      <div className="absolute inset-1 rounded-full border border-white/20" />
      <div className="absolute inset-2 rounded-full border border-white/10" />
    </div>
  );
};

/** Desk calendar page */
export const DeskCalendar = ({ month, year }: { month: string; year: string }) => (
  <div className="paper-texture rounded-sm p-2 w-20 text-center shadow-md">
    <div className="bg-red-800 text-white text-[10px] font-bold py-0.5 rounded-t-sm -mx-2 -mt-2 mb-1">
      {month}
    </div>
    <div className="text-2xl font-serif text-amber-900">{year}</div>
    <div className="text-[8px] text-amber-900/60">FY {year}-{parseInt(year) + 1}</div>
  </div>
);

/** Paperweight */
export const Paperweight = () => (
  <div className="relative w-12 h-10">
    <div className="absolute bottom-0 w-12 h-6 bg-gradient-to-b from-slate-400 to-slate-600 rounded-full shadow-lg" />
    <div className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-8 bg-gradient-to-br from-slate-300 to-slate-500 rounded-full shadow-inner" />
    <div className="absolute top-2 left-1/2 -translate-x-1/2 text-[8px]">🏛️</div>
  </div>
);

/** Complete desk scene with decorative elements */
export const DeskScene = ({ children }: { children: React.ReactNode }) => (
  <div className="relative min-h-screen">
    {/* Decorative desk items in corners */}
    <div className="fixed top-4 right-4 opacity-30 pointer-events-none hidden lg:block">
      <PenHolder />
    </div>
    <div className="fixed top-4 left-4 opacity-30 pointer-events-none hidden lg:block">
      <InkBottle />
    </div>
    <div className="fixed bottom-4 right-4 opacity-20 pointer-events-none hidden lg:block">
      <FileStack count={4} />
    </div>
    <div className="fixed bottom-4 left-4 opacity-20 pointer-events-none hidden lg:block">
      <Paperweight />
    </div>
    {children}
  </div>
);
