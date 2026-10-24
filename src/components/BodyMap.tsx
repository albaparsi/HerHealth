export type Region =
  | "head"
  | "jaw"
  | "chest"
  | "left_arm"
  | "back"
  | "lower_back"
  | "stomach"
  | "pelvis"
  | "whole_body";

export type Symptom = { label: string; region: Region };

// Front view; the figure's left arm is on the viewer's right.
const POINTS: Record<Exclude<Region, "whole_body">, [number, number]> = {
  head: [100, 30],
  jaw: [100, 60],
  chest: [92, 118],
  left_arm: [150, 165],
  back: [112, 100],
  lower_back: [114, 196],
  stomach: [100, 172],
  pelvis: [100, 222],
};

const REGION_NAMES: Record<Region, string> = {
  head: "Head",
  jaw: "Jaw / neck",
  chest: "Chest",
  left_arm: "Left arm",
  back: "Upper back",
  lower_back: "Lower back",
  stomach: "Stomach",
  pelvis: "Pelvis",
  whole_body: "Whole body",
};

/** A clinical-style body outline with numbered markers for each symptom. */
export default function BodyMap({ symptoms, active }: { symptoms: Symptom[]; active?: number }) {
  const wholeBody = symptoms.some((s) => s.region === "whole_body");

  return (
    <div className="flex items-start gap-5">
      <svg viewBox="0 0 200 390" className="w-28 shrink-0 sm:w-44" role="img" aria-label="Body diagram">
        <g
          fill="#e7eaee"
          stroke={wholeBody ? "#164e63" : "#c9ced5"}
          strokeWidth={wholeBody ? 2 : 1}
          strokeDasharray={wholeBody ? "4 3" : undefined}
        >
          <circle cx="100" cy="36" r="24" />
          <rect x="90" y="56" width="20" height="16" rx="4" />
          <path d="M62 78 Q100 66 138 78 L146 150 Q140 196 132 206 L128 246 L72 246 L68 206 Q60 196 54 150 Z" />
          <path d="M62 80 Q48 86 46 104 L36 196 Q34 206 42 208 Q48 208 50 198 L64 120 Z" />
          <path d="M138 80 Q152 86 154 104 L164 196 Q166 206 158 208 Q152 208 150 198 L136 120 Z" />
          <path d="M74 244 L70 370 Q70 380 82 380 L90 380 L98 252 Z" />
          <path d="M126 244 L130 370 Q130 380 118 380 L110 380 L102 252 Z" />
        </g>
        {symptoms.map((s, i) => {
          if (s.region === "whole_body") return null;
          const [x, y] = POINTS[s.region];
          const isActive = active === undefined || active === i;
          return (
            <g key={i} opacity={isActive ? 1 : 0.35}>
              {isActive && (
                <circle cx={x} cy={y} r="6" fill="#b42318" style={{ animation: "pulse-ring 1.6s ease-out infinite" }} />
              )}
              <circle cx={x} cy={y} r="9" fill="#b42318" />
              <text x={x} y={y + 3.5} textAnchor="middle" fontSize="10" fontWeight="700" fill="#fff">
                {i + 1}
              </text>
            </g>
          );
        })}
      </svg>

      <ol className="grid flex-1 gap-2 text-sm">
        {symptoms.map((s, i) => (
          <li
            key={i}
            className={`flex items-start gap-3 rounded-md border px-3 py-2 transition ${
              active === undefined || active === i ? "border-line bg-surface" : "border-transparent opacity-50"
            }`}
          >
            <span className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-alert text-[10px] font-bold text-white">
              {i + 1}
            </span>
            <span>
              <span className="font-medium">{s.label}</span>
              <span className="block text-xs text-muted">{REGION_NAMES[s.region]}</span>
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}
