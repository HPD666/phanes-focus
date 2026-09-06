import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from "@/components/ui/input-otp";
import { useAuth } from "@/hooks/use-auth";
import {
  ArrowRight,
  Bot,
  Loader2,
  Lock,
  Mail,
  UserX,
} from "lucide-react";
import { Suspense, useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router";

interface AuthProps {
  redirectAfterAuth?: string;
}

function resolveRedirectAfterAuth(
  returnTo: string | null,
  fallback = "/dashboard",
) {
  if (returnTo?.startsWith("/") && !returnTo.startsWith("//")) {
    return returnTo;
  }
  return fallback;
}

function Corner({ className }: { className: string }) {
  return (
    <div
      className={`pointer-events-none absolute size-10 border-[#52e0ff]/40 ${className}`}
    />
  );
}

function HudButton({
  className = "",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      {...props}
      className={`cursor-pointer rounded-sm border border-[#52e0ff]/50 bg-[#52e0ff]/10 px-4 py-2.5 font-mono text-[11px] uppercase tracking-[0.2em] text-[#a8ecff] transition-all hover:bg-[#52e0ff]/20 disabled:pointer-events-none disabled:opacity-40 ${className}`}
    />
  );
}

function Auth({ redirectAfterAuth }: AuthProps = {}) {
  const { isLoading: authLoading, isAuthenticated, signIn } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const redirect = resolveRedirectAfterAuth(
    searchParams.get("returnTo"),
    redirectAfterAuth,
  );
  const [step, setStep] = useState<"signIn" | { email: string }>("signIn");
  const [otp, setOtp] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && isAuthenticated) {
      navigate(redirect);
    }
  }, [authLoading, isAuthenticated, navigate, redirect]);

  const handleEmailSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsLoading(true);
    setError(null);
    try {
      const formData = new FormData(event.currentTarget);
      await signIn("email-otp", formData);
      setStep({ email: formData.get("email") as string });
      setIsLoading(false);
    } catch (error) {
      console.error("Email sign-in error:", error);
      setError(
        error instanceof Error
          ? error.message
          : "Failed to send verification code. Please try again.",
      );
      setIsLoading(false);
    }
  };

  const handleOtpSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsLoading(true);
    setError(null);
    try {
      const formData = new FormData(event.currentTarget);
      await signIn("email-otp", formData);
      navigate(redirect);
    } catch (error) {
      console.error("OTP verification error:", error);
      setError("The verification code you entered is incorrect.");
      setIsLoading(false);
      setOtp("");
    }
  };

  const handleGuestLogin = async () => {
    setIsLoading(true);
    setError(null);
    try {
      await signIn("anonymous");
      navigate(redirect);
    } catch (error) {
      console.error("Guest login error:", error);
      setError(
        `Failed to sign in as guest: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
      setIsLoading(false);
    }
  };

  return (
    <div className="relative flex min-h-screen flex-col overflow-hidden bg-[#02040a] text-white">
      {/* backdrop */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "linear-gradient(to bottom, rgba(8,18,34,0.9), #02040a), radial-gradient(ellipse at 50% 0%, rgba(82,224,255,0.10), transparent 55%), radial-gradient(ellipse at 85% 90%, rgba(255,180,84,0.05), transparent 45%)",
        }}
      />
      <div className="hud-scanlines pointer-events-none absolute inset-0" />
      {/* perspective grid */}
      <div
        className="pointer-events-none absolute inset-x-0 bottom-0 h-48 opacity-40"
        style={{
          background:
            "repeating-linear-gradient(0deg, transparent 0 3px, rgba(80,200,255,0.07) 3px 4px)",
          maskImage: "linear-gradient(to top, black, transparent)",
          WebkitMaskImage: "linear-gradient(to top, black, transparent)",
        }}
      />
      <Corner className="left-4 top-14 border-l-2 border-t-2" />
      <Corner className="right-4 top-14 border-r-2 border-t-2" />
      <Corner className="bottom-20 left-4 border-b-2 border-l-2" />
      <Corner className="bottom-20 right-4 border-b-2 border-r-2" />

      {/* top status bar */}
      <header className="relative z-10 flex h-11 items-center justify-between border-b border-white/10 bg-[#02060d]/70 px-4 backdrop-blur-sm">
        <div className="flex items-center gap-3">
          <span className="text-sm leading-none text-[#52e0ff]">◈</span>
          <span className="font-display text-sm font-semibold tracking-[0.25em] text-white">
            PHANES
          </span>
          <span className="hud-label hidden sm:inline">Operator Uplink</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="hud-label hidden md:inline">
            Auth · Email OTP / Guest
          </span>
          <span className="hud-label flex items-center gap-1.5 text-[#7dff9b]">
            <span className="size-1.5 animate-pulse rounded-full bg-[#7dff9b]" />
            FREE FOREVER
          </span>
          <button
            type="button"
            onClick={() => navigate("/")}
            className="hud-label cursor-pointer rounded-sm border border-white/10 px-2 py-1 transition-colors hover:border-white/30"
          >
            ← Landing
          </button>
        </div>
      </header>

      {/* Auth Content */}
      <div className="relative z-10 flex flex-1 items-center justify-center px-4 py-10">
        <div className="w-full max-w-[400px]">
          <div className="hud-panel relative rounded-sm p-6 sm:p-8">
            {/* accent corner brackets */}
            <span className="absolute left-0 top-0 size-3 border-l-2 border-t-2 border-[#52e0ff]" />
            <span className="absolute right-0 top-0 size-3 border-r-2 border-t-2 border-[#52e0ff]" />
            <span className="absolute bottom-0 left-0 size-3 border-b-2 border-l-2 border-[#52e0ff]" />
            <span className="absolute bottom-0 right-0 size-3 border-b-2 border-r-2 border-[#52e0ff]" />

            {step === "signIn" ? (
              <>
                <div className="flex items-center gap-3">
                  <div className="flex size-11 items-center justify-center rounded-sm border border-[#52e0ff]/40 bg-[#52e0ff]/5">
                    <Lock className="size-5 text-[#52e0ff]" />
                  </div>
                  <div>
                    <h1 className="font-display text-lg font-bold tracking-wide text-white">
                      Operator Uplink
                    </h1>
                    <p className="hud-label mt-0.5">
                      Enter email to log in or sign up
                    </p>
                  </div>
                </div>

                <form onSubmit={handleEmailSubmit} className="mt-7">
                  <label className="hud-label mb-2 block" htmlFor="email">
                    // IDENTIFIER
                  </label>
                  <div className="flex items-stretch gap-2">
                    <div className="relative flex-1">
                      <Mail className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[#7fb2d8]/70" />
                      <input
                        id="email"
                        name="email"
                        placeholder="name@example.com"
                        type="email"
                        required
                        disabled={isLoading}
                        className="h-11 w-full rounded-sm border border-white/15 bg-black/40 pl-10 pr-3 font-mono text-[13px] text-white placeholder:text-white/25 focus:border-[#52e0ff]/60 focus:outline-none disabled:opacity-50"
                      />
                    </div>
                    <button
                      type="submit"
                      disabled={isLoading}
                      aria-label="Send code"
                      className="flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-sm border border-[#52e0ff]/50 bg-[#52e0ff]/10 text-[#a8ecff] transition-all hover:bg-[#52e0ff]/20 disabled:opacity-40"
                    >
                      {isLoading ? (
                        <Loader2 className="size-4 animate-spin" />
                      ) : (
                        <ArrowRight className="size-4" />
                      )}
                    </button>
                  </div>
                  {error && (
                    <p className="mt-3 rounded-sm border border-red-400/30 bg-red-950/30 px-3 py-2 font-mono text-[11px] text-red-300/90">
                      ⚠ {error}
                    </p>
                  )}

                  <div className="my-6 flex items-center gap-3">
                    <span className="h-px flex-1 bg-white/10" />
                    <span className="hud-label text-white/40">or</span>
                    <span className="h-px flex-1 bg-white/10" />
                  </div>

                  <HudButton
                    onClick={handleGuestLogin}
                    disabled={isLoading}
                    className="w-full"
                  >
                    <UserX className="size-4" />
                    Continue as Guest
                  </HudButton>
                </form>
              </>
            ) : (
              <>
                <div className="flex items-center gap-3">
                  <div className="flex size-11 items-center justify-center rounded-sm border border-[#52e0ff]/40 bg-[#52e0ff]/5">
                    <Bot className="size-5 text-[#52e0ff]" />
                  </div>
                  <div>
                    <h1 className="font-display text-lg font-bold tracking-wide text-white">
                      Verify Uplink
                    </h1>
                    <p className="hud-label mt-0.5">
                      Code sent to {step.email}
                    </p>
                  </div>
                </div>

                <form onSubmit={handleOtpSubmit} className="mt-7">
                  <input type="hidden" name="email" value={step.email} />
                  <input type="hidden" name="code" value={otp} />

                  <label className="hud-label mb-2 block">
                    // SIX-DIGIT CODE
                  </label>
                  <div className="flex justify-center">
                    <InputOTP
                      value={otp}
                      onChange={setOtp}
                      maxLength={6}
                      disabled={isLoading}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && otp.length === 6 && !isLoading) {
                          const form = (e.target as HTMLElement).closest("form");
                          if (form) form.requestSubmit();
                        }
                      }}
                      containerClassName="gap-2"
                    >
                      <InputOTPGroup>
                        {Array.from({ length: 6 }).map((_, index) => (
                          <InputOTPSlot
                            key={index}
                            index={index}
                            className="h-11 w-10 rounded-none border-white/20 bg-black/40 font-mono text-base text-white first:rounded-l-sm last:rounded-r-sm data-[active=true]:border-[#52e0ff]/70 data-[active=true]:ring-[#52e0ff]/30"
                          />
                        ))}
                      </InputOTPGroup>
                    </InputOTP>
                  </div>
                  {error && (
                    <p className="mt-3 rounded-sm border border-red-400/30 bg-red-950/30 px-3 py-2 font-mono text-[11px] text-red-300/90">
                      ⚠ {error}
                    </p>
                  )}

                  <button
                    type="submit"
                    disabled={isLoading || otp.length !== 6}
                    className="mt-7 flex w-full cursor-pointer items-center justify-center gap-2 rounded-sm border border-[#52e0ff]/50 bg-[#52e0ff]/10 px-4 py-2.5 font-mono text-[11px] uppercase tracking-[0.2em] text-[#a8ecff] transition-all hover:bg-[#52e0ff]/20 disabled:pointer-events-none disabled:opacity-40"
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="size-4 animate-spin" />
                        Verifying…
                      </>
                    ) : (
                      <>
                        Verify code
                        <ArrowRight className="size-4" />
                      </>
                    )}
                  </button>

                  <div className="mt-3 flex items-center justify-between">
                    <HudButton
                      onClick={() => setStep("signIn")}
                      disabled={isLoading}
                      className="border-white/15 bg-transparent px-3 py-2 text-[9px] text-white/60 hover:bg-white/5 hover:text-white"
                    >
                      Use different email
                    </HudButton>
                    <span className="hud-label text-white/35">
                      Didn't get it? Resend
                    </span>
                  </div>
                </form>
              </>
            )}
          </div>

          {/* bottom layer-strip nod to the Focus UI */}
          <div className="mt-6 flex items-center justify-center gap-2">
            <span className="hud-label text-white/30">10 layers</span>
            {["#52e0ff", "#ffb454", "#c3a1ff", "#ffcf3f", "#6fb5ff", "#ff8fa3", "#7dff9b", "#9fb6ff", "#2ff3e0", "#ff5d6c"].map(
              (c) => (
                <span
                  key={c}
                  className="size-1.5 rounded-full"
                  style={{ backgroundColor: c, boxShadow: `0 0 6px ${c}` }}
                />
              ),
            )}
            <span className="hud-label text-[#e8f6ff]/60">+ OMNI</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function AuthPage(props: AuthProps) {
  return (
    <Suspense>
      <Auth {...props} />
    </Suspense>
  );
}