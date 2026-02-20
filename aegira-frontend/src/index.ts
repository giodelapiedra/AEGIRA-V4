interface AssetsBinding {
  fetch: (request: Request) => Promise<Response>;
}

interface WorkerEnv {
  ASSETS: AssetsBinding;
}

export default {
  async fetch(request: Request, env: WorkerEnv): Promise<Response> {
    return env.ASSETS.fetch(request);
  },
};
