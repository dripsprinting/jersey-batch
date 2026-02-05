import { motion } from "framer-motion";

interface JerseyPreviewProps {
  playerName: string;
  jerseyNumber: string;
  style: "home" | "away";
  size?: "sm" | "md" | "lg";
}

export function JerseyPreview({ 
  playerName, 
  jerseyNumber, 
  style,
  size = "md" 
}: JerseyPreviewProps) {
  const isHome = style === "home";
  
  const sizeClasses = {
    sm: "w-32 h-40",
    md: "w-48 h-60",
    lg: "w-64 h-80",
  };

  const numberSizes = {
    sm: "text-4xl",
    md: "text-6xl",
    lg: "text-8xl",
  };

  const nameSizes = {
    sm: "text-xs",
    md: "text-sm",
    lg: "text-base",
  };

  return (
    <motion.div
      initial={{ scale: 0.9, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ type: "spring", stiffness: 200, damping: 20 }}
      className={`jersey-card ${sizeClasses[size]}`}
    >
      <svg
        viewBox="0 0 200 250"
        className="w-full h-full"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <linearGradient id={`jersey-gradient-${style}`} x1="0%" y1="0%" x2="100%" y2="100%">
            {isHome ? (
              <>
                <stop offset="0%" stopColor="hsl(238, 84%, 55%)" />
                <stop offset="100%" stopColor="hsl(263, 70%, 50%)" />
              </>
            ) : (
              <>
                <stop offset="0%" stopColor="hsl(215, 25%, 27%)" />
                <stop offset="100%" stopColor="hsl(215, 25%, 20%)" />
              </>
            )}
          </linearGradient>
          <filter id="jersey-shadow" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="4" stdDeviation="6" floodOpacity="0.3" />
          </filter>
        </defs>

        {/* Jersey Body */}
        <path
          d="M100 20 
             L60 30 L30 50 L20 90 L35 95 L40 70 L45 200 
             L155 200 L160 70 L165 95 L180 90 L170 50 L140 30 L100 20 Z"
          fill={`url(#jersey-gradient-${style})`}
          filter="url(#jersey-shadow)"
          className="transition-all duration-300"
        />

        {/* Collar / V-Neck */}
        <path
          d="M100 20 L80 45 L100 55 L120 45 L100 20 Z"
          fill={isHome ? "hsl(0, 0%, 100%)" : "hsl(38, 92%, 50%)"}
          className="transition-all duration-300"
        />

        {/* Sleeve accents */}
        <path
          d="M30 50 L20 90 L35 95 L40 70 L45 60 Z"
          fill={isHome ? "hsl(263, 70%, 45%)" : "hsl(215, 25%, 35%)"}
          opacity="0.6"
        />
        <path
          d="M170 50 L180 90 L165 95 L160 70 L155 60 Z"
          fill={isHome ? "hsl(263, 70%, 45%)" : "hsl(215, 25%, 35%)"}
          opacity="0.6"
        />

        {/* Player Name */}
        <text
          x="100"
          y="85"
          textAnchor="middle"
          className={`font-bold uppercase tracking-wider ${nameSizes[size]}`}
          fill={isHome ? "hsl(0, 0%, 100%)" : "hsl(38, 92%, 50%)"}
          style={{ 
            fontFamily: "Inter, system-ui, sans-serif",
            fontSize: size === "sm" ? "10px" : size === "md" ? "12px" : "14px",
            fontWeight: 700,
            letterSpacing: "0.1em"
          }}
        >
          {playerName.toUpperCase() || "PLAYER"}
        </text>

        {/* Jersey Number */}
        <text
          x="100"
          y="155"
          textAnchor="middle"
          className={`font-bold ${numberSizes[size]}`}
          fill={isHome ? "hsl(0, 0%, 100%)" : "hsl(38, 92%, 50%)"}
          style={{ 
            fontFamily: "Inter, system-ui, sans-serif",
            fontSize: size === "sm" ? "48px" : size === "md" ? "64px" : "80px",
            fontWeight: 800
          }}
        >
          {jerseyNumber || "00"}
        </text>

        {/* Decorative stripes */}
        <line
          x1="45"
          y1="200"
          x2="155"
          y2="200"
          stroke={isHome ? "hsl(0, 0%, 100%)" : "hsl(38, 92%, 50%)"}
          strokeWidth="3"
          opacity="0.8"
        />
      </svg>
    </motion.div>
  );
}
