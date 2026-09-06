import type { Serve } from '@benchmark/schema';

export interface ServeHandle {
  baseUrl: string;
  stop: () => Promise<void>;
}

/** Starts a task's `serve.run` command and polls `readyPath` until it answers 200 or times out. */
export async function startServe(serve: Serve, cwd: string): Promise<ServeHandle> {
  const env: Record<string, string> = { ...process.env, PORT: String(serve.port) } as Record<
    string,
    string
  >;
  const proc = Bun.spawn(['sh', '-c', serve.run], { cwd, env, stdout: 'pipe', stderr: 'pipe' });

  const baseUrl = `http://localhost:${serve.port}`;
  const readyUrl = new URL(serve.readyPath, baseUrl).toString();
  const deadline = Date.now() + serve.readyTimeoutSeconds * 1000;

  const stop = async (): Promise<void> => {
    try {
      proc.kill('SIGTERM');
    } catch {
      // already exited
    }
    await Promise.race([proc.exited, new Promise((resolve) => setTimeout(resolve, 5000))]);
    try {
      proc.kill('SIGKILL');
    } catch {
      // already exited
    }
  };

  let ready = false;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(readyUrl);
      if (response.status === 200) {
        ready = true;
        break;
      }
    } catch {
      // server not accepting connections yet
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  if (!ready) {
    await stop();
    throw new Error(
      `serve command did not answer 200 at ${readyUrl} within ${serve.readyTimeoutSeconds}s`,
    );
  }

  return { baseUrl, stop };
}
