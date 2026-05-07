import { GenerateScriptRequestDto } from '../dto/generate-script.dto';
import { SceneTransition, VideoStyle, VideoPlatform } from '../enums/video.enums';

export interface IScene {
  id: string;
  sequenceNumber: number;
  narration: string;
  imageDescription: string;
  duration: number;
  transition: SceneTransition;
}

export interface IVideoScript {
  title: string;
  description: string;
  platform: VideoPlatform;
  style: VideoStyle;
  scenes: IScene[];
  totalDuration: number;
  generatedAt: Date;
}

export interface IScriptGenerator {
  generateScript(request: GenerateScriptRequestDto): Promise<IVideoScript>;
  getProviderName(): string;
}
