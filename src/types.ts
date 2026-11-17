export type Option={id:string;text:string;score:number};
export type Question={id:string;position:number;text:string;dimension:string;enabled:boolean;options:Option[]};
export type Template={name:string;keywords:string[];comment:string;portrait:{heading:string;text:string}[];portraitOriginal?:string;advice:string[];adviceOriginal?:string;summary:string;illustrationAlt:string;image:string};
export type Rules={groups:Record<string,string[]>;priority:string[];balancedDefault:string;easterEnabled:boolean;easterThreshold:number};
export type Version={id?:string;questions:Question[];results:Record<string,Template>;dimensionNames:string[];rules:Rules;pages:{title:string;subtitle:string;button:string;intro:string;privacy:string;about:string}};
export type Result={id:string;versionId:string;createdAt:number;expiresAt:number;dimensions:number[];dimensionNames:string[];combos:Record<string,number>;base_result_code:string;display_result_code:string;is_easter_egg:boolean;balanced:boolean;template:Template;displayTemplate:Template};
export type Progress={id:string;versionId:string;startedAt:number;current:number;answers:Record<string,string>};
export type Admin={id:string;username:string;role:'super'|'editor'|'viewer';can_export_details:boolean;active:boolean};
