
import type { IKVService } from '../../kv/types/service.interface';
import type { ID1Service } from '../../d1/types/service.interface';
import { generateId } from '../../../infrastructure/utils/helpers';


export interface AudioProject {
  id: string;
  name: string;
  description?: string;
  userId: string;
  settings: AudioProjectSettings;
  voices: VoiceProfile[];
  createdAt: number;
  updatedAt: number;
}

export interface AudioProjectSettings {
  defaultTTSEngine: 'workers-ai' | 'custom';
  defaultTTSModel?: string;
  audioQuality: 'low' | 'medium' | 'high';
  outputFormat: 'mp3' | 'wav' | 'ogg';
  enableEmotionControl: boolean;
  maxDuration: number;
}

export interface VoiceProfile {
  id: string;
  name: string;
  description?: string;
  type: 'cloned' | 'preset' | 'custom';
  createdAt: number;
  settings: VoiceProfileSettings;
}

export interface VoiceProfileSettings {
  ttsModel?: string;
  language?: string;
  emotion?: string;
  speed?: number;
  pitch?: number;
  sampleRate?: number;
  customParameters?: Record<string, unknown>;
}

export interface AudioProjectCreateOptions {
  name: string;
  description?: string;
  userId: string;
  settings?: Partial<AudioProjectSettings>;
}

export interface AudioProjectUpdateOptions {
  name?: string;
  description?: string;
  settings?: Partial<AudioProjectSettings>;
}

export interface VoiceProfileCreateOptions {
  name: string;
  description?: string;
  type: 'cloned' | 'preset' | 'custom';
  settings?: VoiceProfileSettings;
}


interface DbAudioProjectRow {
  id: string;
  name: string;
  description: string | null;
  user_id: string;
  settings: string;
  created_at: number;
  updated_at: number;
}

interface DbVoiceRow {
  id: string;
  name: string;
  description: string | null;
  type: string;
  settings: string;
  created_at: number;
}

export class AudioProjectService {
  private kv?: IKVService;
  private d1?: ID1Service;
  private cache: Map<string, AudioProject> = new Map();
  private maxCacheSize: number = 100;
  private cacheEnabled: boolean = true;

  constructor(kv?: IKVService, d1?: ID1Service, options?: { cacheEnabled?: boolean; maxCacheSize?: number }) {
    this.kv = kv;
    this.d1 = d1;
    this.cacheEnabled = options?.cacheEnabled ?? true;
    this.maxCacheSize = options?.maxCacheSize ?? 100;
  }


  async createProject(options: AudioProjectCreateOptions): Promise<AudioProject> {
    const project: AudioProject = {
      id: this.generateId(),
      name: options.name,
      description: options.description,
      userId: options.userId,
      settings: this.mergeDefaultSettings(options.settings),
      voices: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    if (this.kv) {
      await this.kv.put(`audio_project:${project.id}`, JSON.stringify(project));
    }

    if (this.d1) {
      await this.saveProjectToD1(project);
    }

    if (this.cacheEnabled) {
      this.cache.set(project.id, project);
      this.cleanupCache();
    }

    return project;
  }

  async getProject(projectId: string): Promise<AudioProject | null> {
    if (this.cacheEnabled && this.cache.has(projectId)) {
      return this.cache.get(projectId)!;
    }

    if (this.kv) {
      const data = await this.kv.get<string>(`audio_project:${projectId}`);
      if (data) {
        const project = JSON.parse(data) as AudioProject;
        if (this.cacheEnabled) {
          this.cache.set(projectId, project);
        }
        return project;
      }
    }

    if (this.d1) {
      const project = await this.loadProjectFromD1(projectId);
      if (project && this.cacheEnabled) {
        this.cache.set(projectId, project);
      }
      return project;
    }

    return null;
  }

  async listProjects(userId: string, options?: { limit?: number; offset?: number }): Promise<AudioProject[]> {
    if (this.d1) {
      return this.listProjectsFromD1(userId, options);
    }

    const projects: AudioProject[] = [];
    for (const [_id, project] of this.cache) {
      if (project.userId === userId) {
        projects.push(project);
      }
    }
    return projects;
  }

  async updateProject(projectId: string, options: AudioProjectUpdateOptions): Promise<AudioProject> {
    const project = await this.getProject(projectId);
    if (!project) {
      throw new Error(`Project ${projectId} not found`);
    }

    if (options.name) project.name = options.name;
    if (options.description !== undefined) project.description = options.description;
    if (options.settings) {
      project.settings = { ...project.settings, ...options.settings };
    }
    project.updatedAt = Date.now();

    await this.saveProject(project);

    return project;
  }

  async deleteProject(projectId: string): Promise<void> {
    this.cache.delete(projectId);

    if (this.kv) {
      await this.kv.delete(`audio_project:${projectId}`);
    }

    if (this.d1) {
      await this.deleteProjectFromD1(projectId);
    }
  }


  async addVoiceProfile(projectId: string, options: VoiceProfileCreateOptions): Promise<VoiceProfile> {
    const project = await this.getProject(projectId);
    if (!project) {
      throw new Error(`Project ${projectId} not found`);
    }

    const voice: VoiceProfile = {
      id: this.generateId(),
      name: options.name,
      description: options.description,
      type: options.type,
      createdAt: Date.now(),
      settings: options.settings || {},
    };

    project.voices.push(voice);
    project.updatedAt = Date.now();

    await this.saveProject(project);

    return voice;
  }

  async getVoiceProfile(projectId: string, voiceId: string): Promise<VoiceProfile | null> {
    const project = await this.getProject(projectId);
    if (!project) return null;

    return project.voices.find(v => v.id === voiceId) || null;
  }

  async listVoiceProfiles(projectId: string): Promise<VoiceProfile[]> {
    const project = await this.getProject(projectId);
    return project?.voices || [];
  }

  async updateVoiceProfile(projectId: string, voiceId: string, settings: Partial<VoiceProfileSettings>): Promise<VoiceProfile> {
    const project = await this.getProject(projectId);
    if (!project) {
      throw new Error(`Project ${projectId} not found`);
    }

    const voice = project.voices.find(v => v.id === voiceId);
    if (!voice) {
      throw new Error(`Voice profile ${voiceId} not found`);
    }

    voice.settings = { ...voice.settings, ...settings };
    project.updatedAt = Date.now();

    await this.saveProject(project);

    return voice;
  }

  async deleteVoiceProfile(projectId: string, voiceId: string): Promise<void> {
    const project = await this.getProject(projectId);
    if (!project) return;

    project.voices = project.voices.filter(v => v.id !== voiceId);
    project.updatedAt = Date.now();

    await this.saveProject(project);
  }

  async setDefaultVoice(projectId: string, voiceId: string): Promise<void> {
    const project = await this.getProject(projectId);
    if (!project) {
      throw new Error(`Project ${projectId} not found`);
    }

    const voice = project.voices.find(v => v.id === voiceId);
    if (!voice) {
      throw new Error(`Voice profile ${voiceId} not found`);
    }

    project.settings.defaultTTSModel = voiceId;
    project.updatedAt = Date.now();

    await this.saveProject(project);
  }


  async searchProjects(userId: string, query: string): Promise<AudioProject[]> {
    const projects = await this.listProjects(userId);
    const lowerQuery = query.toLowerCase();

    return projects.filter(p =>
      p.name.toLowerCase().includes(lowerQuery) ||
      (p.description && p.description.toLowerCase().includes(lowerQuery))
    );
  }

  async getProjectsByVoiceType(userId: string, voiceType: 'cloned' | 'preset' | 'custom'): Promise<AudioProject[]> {
    const projects = await this.listProjects(userId);
    return projects.filter(p =>
      p.voices.some(v => v.type === voiceType)
    );
  }


  async getProjectStats(projectId: string): Promise<{
    voiceCount: number;
    clonedVoices: number;
    presetVoices: number;
    customVoices: number;
    createdAt: number;
    lastUpdated: number;
  } | null> {
    const project = await this.getProject(projectId);
    if (!project) return null;

    return {
      voiceCount: project.voices.length,
      clonedVoices: project.voices.filter(v => v.type === 'cloned').length,
      presetVoices: project.voices.filter(v => v.type === 'preset').length,
      customVoices: project.voices.filter(v => v.type === 'custom').length,
      createdAt: project.createdAt,
      lastUpdated: project.updatedAt,
    };
  }

  async getUserStats(userId: string): Promise<{
    totalProjects: number;
    totalVoices: number;
    clonedVoices: number;
    presetVoices: number;
    customVoices: number;
  }> {
    const projects = await this.listProjects(userId);
    const allVoices = projects.flatMap(p => p.voices);

    return {
      totalProjects: projects.length,
      totalVoices: allVoices.length,
      clonedVoices: allVoices.filter(v => v.type === 'cloned').length,
      presetVoices: allVoices.filter(v => v.type === 'preset').length,
      customVoices: allVoices.filter(v => v.type === 'custom').length,
    };
  }


  private mergeDefaultSettings(settings?: Partial<AudioProjectSettings>): AudioProjectSettings {
    return {
      defaultTTSEngine: 'workers-ai',
      audioQuality: 'medium',
      outputFormat: 'mp3',
      enableEmotionControl: false,
      maxDuration: 300,
      ...settings,
    };
  }

  private async saveProject(project: AudioProject): Promise<void> {
    if (this.cacheEnabled) {
      this.cache.set(project.id, project);
    }

    if (this.kv) {
      await this.kv.put(`audio_project:${project.id}`, JSON.stringify(project));
    }

    if (this.d1) {
      await this.saveProjectToD1(project);
    }
  }

  private cleanupCache(): void {
    if (this.cache.size > this.maxCacheSize) {
      const entries = Array.from(this.cache.entries());
      const toRemove = this.cache.size - this.maxCacheSize;
      for (let i = 0; i < toRemove; i++) {
        const entry = entries[i];
        if (entry) {
          this.cache.delete(entry[0]);
        }
      }
    }
  }

  private generateId(): string {
    return generateId();
  }


  private async saveProjectToD1(project: AudioProject): Promise<void> {
    if (!this.d1) return;

    await this.d1.query(`
      INSERT OR REPLACE INTO audio_projects (id, name, description, user_id, settings, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `, [
      project.id,
      project.name,
      project.description || '',
      project.userId,
      JSON.stringify(project.settings),
      project.createdAt,
      project.updatedAt,
    ]);
  }

  private async loadProjectFromD1(projectId: string): Promise<AudioProject | null> {
    if (!this.d1) return null;

    const result = await this.d1.query(`
      SELECT * FROM audio_projects WHERE id = ?
    `, [projectId]);

    if (!result.rows || result.rows.length === 0) return null;

    const row = result.rows[0] as DbAudioProjectRow;
    const project: AudioProject = {
      id: row.id,
      name: row.name,
      description: row.description ?? undefined,
      userId: row.user_id,
      settings: JSON.parse(row.settings) as AudioProject['settings'],
      voices: await this.loadVoicesFromD1(projectId),
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };

    return project;
  }

  private async loadVoicesFromD1(projectId: string): Promise<VoiceProfile[]> {
    if (!this.d1) return [];

    const result = await this.d1.query(`
      SELECT * FROM voice_profiles WHERE project_id = ?
    `, [projectId]);

    if (!result.rows || result.rows.length === 0) return [];

    return (result.rows as DbVoiceRow[]).map((row) => ({
      id: row.id,
      name: row.name,
      description: row.description ?? undefined,
      type: row.type as VoiceProfile['type'],
      createdAt: row.created_at,
      settings: JSON.parse(row.settings) as VoiceProfileSettings,
    }));
  }

  private async listProjectsFromD1(userId: string, options?: { limit?: number; offset?: number }): Promise<AudioProject[]> {
    if (!this.d1) return [];

    const limit = options?.limit || 50;
    const offset = options?.offset || 0;

    const result = await this.d1.query(`
      SELECT id FROM audio_projects
      WHERE user_id = ?
      ORDER BY updated_at DESC
      LIMIT ? OFFSET ?
    `, [userId, limit, offset]);

    if (!result.rows || result.rows.length === 0) return [];

    const projects: AudioProject[] = [];
    for (const row of result.rows as Array<{ id: string }>) {
      const project = await this.loadProjectFromD1(row.id);
      if (project) projects.push(project);
    }

    return projects;
  }

  private async deleteProjectFromD1(projectId: string): Promise<void> {
    if (!this.d1) return;

    await this.d1.query(`DELETE FROM voice_profiles WHERE project_id = ?`, [projectId]);

    await this.d1.query(`DELETE FROM audio_projects WHERE id = ?`, [projectId]);
  }
}


export function createAudioProjectService(
  kv?: IKVService,
  d1?: ID1Service,
  options?: { cacheEnabled?: boolean; maxCacheSize?: number }
): AudioProjectService {
  return new AudioProjectService(kv, d1, options);
}

export const audioProjectService = new AudioProjectService();
