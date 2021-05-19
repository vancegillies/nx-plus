import { BuildOptions, createServer } from 'vite';
import { cleanViteOptions } from '../../utils';
import { ViteDevServerExecutorSchema } from './schema';

export default async function* runExecutor(
  options: ViteDevServerExecutorSchema
) {
  const server = await createServer({
    base: options.base,
    mode: options.mode,
    configFile: options.config,
    logLevel: options.logLevel,
    clearScreen: options.clearScreen,
    server: cleanViteOptions(options) as BuildOptions,
  });
  await server.listen();
  yield {
    baseUrl: `http://localhost:${server.config.server.port}`,
    success: true,
  };
  // This Promise intentionally never resolves, leaving the process running
  // eslint-disable-next-line @typescript-eslint/no-empty-function
  await new Promise<{ success: boolean }>(() => {});
}
