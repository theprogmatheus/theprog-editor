import { GitEngine } from '../services/git/gitEngine';

const engine = new GitEngine();

self.onmessage = async (e: MessageEvent) => {
  const { id, type, payload } = e.data;

  try {
    let result: any = null;

    switch (type) {
      case 'IS_INITIALIZED':
        result = await engine.isInitialized();
        break;

      case 'INIT':
        await engine.init(payload?.defaultBranch || 'main');
        result = true;
        break;

      case 'GET_STATUS':
        result = await engine.getStatus(payload?.files || []);
        break;

      case 'STAGE':
        await engine.stage(payload.filepath);
        result = true;
        break;

      case 'STAGE_ALL':
        await engine.stageAll(payload?.files || []);
        result = true;
        break;

      case 'UNSTAGE':
        await engine.unstage(payload.filepath);
        result = true;
        break;

      case 'UNSTAGE_ALL':
        await engine.unstageAll();
        result = true;
        break;

      case 'DISCARD':
        result = await engine.discard(payload.filepath);
        break;

      case 'COMMIT':
        result = await engine.commit(payload.message, payload.author);
        break;

      case 'LOG':
        result = await engine.log(payload?.depth || 30);
        break;

      case 'READ_AT_COMMIT':
        result = await engine.readAtCommit(payload.filepath, payload?.commitRef || 'HEAD');
        break;

      case 'LIST_BRANCHES':
        result = await engine.listBranches();
        break;

      case 'CREATE_BRANCH':
        await engine.createBranch(payload.name);
        result = true;
        break;

      case 'CHECKOUT':
        result = await engine.checkout(payload.name);
        break;

      default:
        throw new Error(`Tipo de mensagem Git desconhecido: ${type}`);
    }

    self.postMessage({ id, success: true, data: result });
  } catch (err: any) {
    self.postMessage({ id, success: false, error: err?.message || String(err) });
  }
};
