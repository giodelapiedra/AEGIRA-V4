export default {
  async fetch(request: Request, env: { ASSETS: any }): Promise<Response> {
    return env.ASSETS.fetch(request);
  },
};
