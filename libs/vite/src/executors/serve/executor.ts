import { createServer } from 'vite';
import { ServeExecutorSchema } from './schema';

export default async function* runExecutor(options: ServeExecutorSchema) {
  const server = await createServer({ configFile: options.viteConfig });
  const res = await server.listen();
  yield {
    baseUrl: 'http://localhost:3000',
    success: true,
  };
  // This Promise intentionally never resolves, leaving the process running
  await new Promise<{ success: boolean }>(() => {});
}
