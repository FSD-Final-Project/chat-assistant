import { cn } from "@/lib/utils";

interface AppLogoProps {
    className?: string;
}

export function AppLogo({ className }: AppLogoProps) {
  return (
    <div
        className={cn(
            "flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-primary via-purple-500 to-pink-500 animate-pulse",
            className
        )}
    >
      <span className="text-sm font-bold text-white">{"\u03b1Xon"}</span>
    </div>
  );
}
