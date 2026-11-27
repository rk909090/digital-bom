export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { bootstrap } = await import("./lib/bootstrap");
  try {
    await bootstrap();
  } catch (e) {
    console.error("[bootstrap] gagal menyiapkan database", e);
  }
  if (process.env.AGENT_SCHEDULER === "off") return;
  const { startScheduler } = await import("./lib/scheduler");
  startScheduler();
}
