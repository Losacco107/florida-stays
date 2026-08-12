export function NoWebGLFallback() {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-canvas px-8 text-center">
      <p className="text-[15px] font-medium text-ink">Your browser can&apos;t show the map</p>
      <p className="text-[13px] text-ink-muted">
        This device or browser doesn&apos;t support the graphics needed for the map view. You
        can still browse every stay in the list below.
      </p>
    </div>
  );
}
