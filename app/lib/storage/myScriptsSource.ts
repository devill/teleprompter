import { StorageSource, ScriptFile } from './types';
import { getAllScripts, getScript, saveScript, deleteScript, StoredScript } from './db';

const SOURCE_ID = 'my-scripts';

function toFileId(scriptId: string): string {
  return `${SOURCE_ID}:${scriptId}`;
}

function toScriptId(fileId: string): string {
  return fileId.replace(`${SOURCE_ID}:`, '');
}

function toScriptFile(script: StoredScript): ScriptFile {
  return {
    id: toFileId(script.id),
    name: script.name,
    sourceId: SOURCE_ID,
  };
}

export const myScriptsSource: StorageSource = {
  id: SOURCE_ID,
  name: 'My Scripts',
  type: 'my-scripts',
  readonly: false,

  async listFiles(): Promise<ScriptFile[]> {
    const scripts = await getAllScripts();
    return scripts.map(toScriptFile);
  },

  async readFile(id: string): Promise<string> {
    const scriptId = toScriptId(id);
    const script = await getScript(scriptId);
    if (!script) {
      throw new Error(`Script not found: ${id}`);
    }
    return script.content;
  },

  async writeFile(id: string, content: string): Promise<void> {
    const scriptId = toScriptId(id);
    const script = await getScript(scriptId);
    if (!script) {
      throw new Error(`Script not found: ${id}`);
    }
    await saveScript({
      ...script,
      content,
      updatedAt: Date.now(),
    });
  },

  async deleteFile(id: string): Promise<void> {
    const scriptId = toScriptId(id);
    await deleteScript(scriptId);
  },

  async renameFile(id: string, newName: string): Promise<void> {
    const scriptId = toScriptId(id);
    const script = await getScript(scriptId);
    if (!script) {
      throw new Error(`Script not found: ${id}`);
    }
    await saveScript({
      ...script,
      name: newName,
      updatedAt: Date.now(),
    });
  },

  async createFile(name: string, content: string): Promise<ScriptFile> {
    const scriptId = crypto.randomUUID();
    const now = Date.now();
    const script: StoredScript = {
      id: scriptId,
      name,
      content,
      createdAt: now,
      updatedAt: now,
    };
    await saveScript(script);
    return toScriptFile(script);
  },
};
