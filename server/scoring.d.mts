import type {Version,Question,Rules,Result} from '../src/types';
export const dimensionNames:string[];
export const defaultRules:Rules;
export function validateVersion(version:Version):string[];
export function validateAnswers(questions:Question[],answers:unknown):{question_id:string;option_id:string;score:number;dimension:string}[];
export function decideType(dimensions:number[],rules?:Rules):Pick<Result,'base_result_code'|'balanced'|'combos'>;
export function calculate(version:Version,answers:unknown):Pick<Result,'dimensions'|'base_result_code'|'display_result_code'|'balanced'|'combos'|'is_easter_egg'>;
