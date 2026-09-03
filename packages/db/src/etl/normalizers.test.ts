import { describe, it, expect } from 'vitest';
import {
  hwToGpuKey,
  resolveModelKey,
  normalizeFramework,
  normalizeSpecMethod,
  parseBool,
  parseOptionalBool,
  parseNum,
  parseInt2,
  parseIslOsl,
  MODEL_TO_KEY,
  GPU_KEYS,
} from './normalizers';
import { DB_MODEL_TO_DISPLAY } from '@semianalysisai/inferencex-constants';

describe('hwToGpuKey', () => {
  it('strips -nv suffix', () => {
    expect(hwToGpuKey('h200-nv')).toBe('h200');
    expect(hwToGpuKey('b200-nv')).toBe('b200');
    expect(hwToGpuKey('gb300-nv')).toBe('gb300');
  });

  it('strips -amd suffix', () => {
    expect(hwToGpuKey('mi355x-amd')).toBe('mi355x');
    expect(hwToGpuKey('mi300x-amd')).toBe('mi300x');
  });

  it('strips a v3 scope prefix (cluster:…)', () => {
    expect(hwToGpuKey('cluster:b300-nv')).toBe('b300');
    expect(hwToGpuKey('cluster:h200')).toBe('h200');
  });

  it('maps the MI350 runner-pool shorthand to MI350X', () => {
    expect(hwToGpuKey('cluster:mi350')).toBe('mi350x');
    expect(hwToGpuKey('CLUSTER:MI350')).toBe('mi350x');
  });

  it('strips -amds suffix', () => {
    expect(hwToGpuKey('mi355x-amds')).toBe('mi355x');
  });

  it('strips -trt suffix', () => {
    expect(hwToGpuKey('h100-trt')).toBe('h100');
  });

  it('strips -multinode-slurm suffix', () => {
    expect(hwToGpuKey('h200-multinode-slurm')).toBe('h200');
  });

  it('strips -multinode suffix', () => {
    expect(hwToGpuKey('b200-multinode')).toBe('b200');
    expect(hwToGpuKey('h200-multinode')).toBe('h200');
  });

  it('strips -nvs suffix', () => {
    expect(hwToGpuKey('h100-nvs')).toBe('h100');
  });

  it('strips -disagg suffix', () => {
    expect(hwToGpuKey('h200-disagg')).toBe('h200');
  });

  it('strips -nvd suffix', () => {
    expect(hwToGpuKey('b200-nvd')).toBe('b200');
  });

  it('strips -dgxc suffix', () => {
    expect(hwToGpuKey('gb200-dgxc')).toBe('gb200');
  });

  it('strips -dgxc-slurm suffix', () => {
    expect(hwToGpuKey('b200-dgxc-slurm')).toBe('b200');
    expect(hwToGpuKey('h200-dgxc-slurm')).toBe('h200');
    expect(hwToGpuKey('h100-dgxc-slurm')).toBe('h100');
  });

  it('strips -nb suffix', () => {
    expect(hwToGpuKey('b300-nb')).toBe('b300');
  });

  it('strips -dsv4 runner-pool suffix', () => {
    expect(hwToGpuKey('b200-dsv4')).toBe('b200');
    expect(hwToGpuKey('B200-DSV4')).toBe('b200');
  });

  it('strips -cw suffix', () => {
    expect(hwToGpuKey('gb300-cw')).toBe('gb300');
  });

  it('strips -lat suffix for RTX PRO 6000 (latency-optimized PCIe SKU)', () => {
    expect(hwToGpuKey('rtx6000pro-lat')).toBe('rtx6000pro');
    expect(hwToGpuKey('rtx6000pro')).toBe('rtx6000pro');
  });

  it('strips runner index suffix before other suffixes', () => {
    expect(hwToGpuKey('mi355x-amd_0')).toBe('mi355x');
    expect(hwToGpuKey('mi355x-amd_2')).toBe('mi355x');
  });

  it('handles bare GPU keys', () => {
    expect(hwToGpuKey('h100')).toBe('h100');
    expect(hwToGpuKey('mi300x')).toBe('mi300x');
    expect(hwToGpuKey('rtx5090')).toBe('rtx5090');
    expect(hwToGpuKey('htx301')).toBe('htx301');
  });

  it('is case-insensitive', () => {
    expect(hwToGpuKey('H200-NV')).toBe('h200');
    expect(hwToGpuKey('MI355X-AMD')).toBe('mi355x');
    expect(hwToGpuKey('HTX301-SKYMIZER')).toBe('htx301');
  });

  it('returns null for unknown hardware', () => {
    expect(hwToGpuKey('a100-nv')).toBeNull();
    expect(hwToGpuKey('v100')).toBeNull();
    expect(hwToGpuKey('')).toBeNull();
    expect(hwToGpuKey('unknown-gpu')).toBeNull();
  });

  it('returns null when stripped base is not a valid GPU key', () => {
    expect(hwToGpuKey('imaginary-nv')).toBeNull();
  });
});

describe('resolveModelKey', () => {
  it('resolves from infmax_model_prefix', () => {
    expect(resolveModelKey({ infmax_model_prefix: 'dsr1' })).toBe('dsr1');
    expect(resolveModelKey({ infmax_model_prefix: 'llama70b' })).toBe('llama70b');
  });

  it('resolves from model_prefix (eval format)', () => {
    expect(resolveModelKey({ model_prefix: 'dsr1' })).toBe('dsr1');
  });

  it('strips precision suffix from prefix', () => {
    expect(resolveModelKey({ infmax_model_prefix: 'dsr1-fp8' })).toBe('dsr1');
    expect(resolveModelKey({ infmax_model_prefix: 'llama70b-fp4' })).toBe('llama70b');
    expect(resolveModelKey({ infmax_model_prefix: 'dsr1-nvfp4-v2' })).toBe('dsr1');
    expect(resolveModelKey({ infmax_model_prefix: 'dsr1-mxfp4' })).toBe('dsr1');
  });

  it('resolves gptoss alias from prefix', () => {
    expect(resolveModelKey({ infmax_model_prefix: 'gptoss' })).toBe('gptoss120b');
  });

  it('resolves dsv4pro alias from prefix', () => {
    expect(resolveModelKey({ infmax_model_prefix: 'dsv4pro' })).toBe('dsv4');
    expect(resolveModelKey({ infmax_model_prefix: 'dsv4pro-fp8' })).toBe('dsv4');
  });

  it('resolves AMD Kimi-K2.7-Code identifiers to the canonical kimik2.7-code key', () => {
    // AMD AgentX sweeps emit the bare prefix `kimik2.7` (no `-code`) and the
    // MXFP4 model path `amd/Kimi-K2.7-Code-MXFP4`; both must fold into the
    // canonical `kimik2.7-code` DB bucket. Regression for GitHub Actions run
    // 29975243963, whose overlay rendered nothing because every row was skipped
    // as an unmapped model.
    expect(resolveModelKey({ infmax_model_prefix: 'kimik2.7' })).toBe('kimik2.7-code');
    expect(resolveModelKey({ infmax_model_prefix: 'kimik2.7-fp4' })).toBe('kimik2.7-code');
    expect(resolveModelKey({ model_prefix: 'kimik2.7' })).toBe('kimik2.7-code');
    expect(resolveModelKey({ model: 'amd/Kimi-K2.7-Code-MXFP4' })).toBe('kimik2.7-code');
    // Canonical identifiers still resolve to the same bucket.
    expect(resolveModelKey({ infmax_model_prefix: 'kimik2.7-code' })).toBe('kimik2.7-code');
    expect(resolveModelKey({ model: 'moonshotai/Kimi-K2.7-Code' })).toBe('kimik2.7-code');
  });

  it('falls back to MODEL_TO_KEY when prefix not present', () => {
    expect(resolveModelKey({ model: 'deepseek-ai/DeepSeek-R1' })).toBe('dsr1');
    expect(resolveModelKey({ model: 'nvidia/Llama-3.3-70B-Instruct-FP8' })).toBe('llama70b');
    expect(resolveModelKey({ model: 'openai/gpt-oss-120b' })).toBe('gptoss120b');
  });

  it('falls back to MODEL_TO_KEY for local mount paths', () => {
    expect(resolveModelKey({ model: '/mnt/lustre01/models/deepseek-r1-0528-fp4-v2' })).toBe('dsr1');
    expect(resolveModelKey({ model: '/models/DeepSeek-R1' })).toBe('dsr1');
  });

  it('prefers infmax_model_prefix over model', () => {
    expect(
      resolveModelKey({
        infmax_model_prefix: 'llama70b',
        model: 'deepseek-ai/DeepSeek-R1',
      }),
    ).toBe('llama70b');
  });

  it('returns null for unknown model', () => {
    expect(resolveModelKey({ model: 'unknown/model' })).toBeNull();
    expect(resolveModelKey({})).toBeNull();
    expect(resolveModelKey({ infmax_model_prefix: 'unknown_model_xyz' })).toBeNull();
  });

  it('resolves qwen3.5 prefix', () => {
    expect(resolveModelKey({ infmax_model_prefix: 'qwen3.5' })).toBe('qwen3.5');
    expect(resolveModelKey({ infmax_model_prefix: 'qwen3.5-fp8' })).toBe('qwen3.5');
  });

  it('resolves models from HuggingFace paths via MODEL_TO_KEY', () => {
    expect(resolveModelKey({ model: 'meta-llama/Llama-3.1-8B' })).toBe('llama31-8b');
    expect(resolveModelKey({ model: 'meta-llama/Llama-3.1-8B-Instruct' })).toBe('llama31-8b');
    expect(resolveModelKey({ model: 'Qwen/Qwen2.5-0.5B-Instruct' })).toBe('qwen25-0.5b');
    expect(resolveModelKey({ model: 'Qwen/Qwen3-Coder-30B-A3B-Instruct' })).toBe(
      'qwen3coder-30b-a3b',
    );
    expect(resolveModelKey({ model: 'deepseek-ai/DeepSeek-V2-Lite' })).toBe('dsv2lite');
    expect(resolveModelKey({ model: 'Qwen/Qwen3-VL-2B-Instruct' })).toBe('qwen3vl-2b');
    expect(resolveModelKey({ model: 'Qwen/Qwen3-VL-30B-A3B-Instruct' })).toBe('qwen3vl-30b-a3b');
    expect(resolveModelKey({ model: 'Qwen/Qwen3-0.6B' })).toBe('qwen3-0.6b');
    expect(resolveModelKey({ model: 'meta-llama/Llama-3.2-1B-Instruct' })).toBe('llama32-1b');
    expect(resolveModelKey({ model: 'Qwen/Qwen2.5-1.5B-Instruct' })).toBe('qwen25-1.5b');
    expect(resolveModelKey({ model: 'google/gemma-2b-it' })).toBe('gemma2b');
    expect(resolveModelKey({ model: 'microsoft/Phi-3-mini-4k-instruct' })).toBe('phi3mini');
    expect(resolveModelKey({ model: 'Qwen/Qwen3.5-397B-A17B' })).toBe('qwen3.5');
    expect(resolveModelKey({ model: 'moonshotai/Kimi-K2.5' })).toBe('kimik2.5');
    expect(resolveModelKey({ model: 'MiniMaxAI/MiniMax-M2.5' })).toBe('minimaxm2.5');
    expect(resolveModelKey({ model: 'zai-org/GLM-5-FP8' })).toBe('glm5');
    expect(resolveModelKey({ model: 'zai-org/GLM-5.2-FP8' })).toBe('glm5.2');
  });

  it('resolves the Llama 3.1 8B identifiers emitted by run 30755775646', () => {
    expect(
      resolveModelKey({
        infmax_model_prefix: 'llama31-8b',
        model: 'meta-llama/Llama-3.1-8B',
      }),
    ).toBe('llama31-8b');
  });

  it('resolves the small-model case identifiers', () => {
    const cases = [
      ['qwen25-0.5b', 'Qwen/Qwen2.5-0.5B-Instruct'],
      ['llama31-8b', 'meta-llama/Llama-3.1-8B-Instruct'],
      ['qwen3coder-30b-a3b', 'Qwen/Qwen3-Coder-30B-A3B-Instruct'],
      ['dsv2lite', 'deepseek-ai/DeepSeek-V2-Lite'],
      ['qwen3vl-2b', 'Qwen/Qwen3-VL-2B-Instruct'],
      ['qwen3vl-30b-a3b', 'Qwen/Qwen3-VL-30B-A3B-Instruct'],
      ['qwen3-0.6b', 'Qwen/Qwen3-0.6B'],
      ['llama32-1b', 'meta-llama/Llama-3.2-1B-Instruct'],
      ['qwen25-1.5b', 'Qwen/Qwen2.5-1.5B-Instruct'],
      ['gemma2b', 'google/gemma-2b-it'],
      ['phi3mini', 'microsoft/Phi-3-mini-4k-instruct'],
    ] as const;

    for (const [prefix, model] of cases) {
      expect(resolveModelKey({ infmax_model_prefix: prefix, model })).toBe(prefix);
    }
  });

  it('resolves Kimi-K3 identifiers to the kimik3 key, not the K2 buckets', () => {
    // K3 is a distinct architecture, so it must land in its own DB bucket.
    // AMD AgentX sweeps emit the bare `kimik3` prefix; the MXFP4 checkpoint is
    // published under the plain moonshotai path. GitHub Actions run 30298924344.
    expect(resolveModelKey({ infmax_model_prefix: 'kimik3' })).toBe('kimik3');
    expect(resolveModelKey({ infmax_model_prefix: 'kimik3-fp4' })).toBe('kimik3');
    expect(resolveModelKey({ model_prefix: 'kimik3' })).toBe('kimik3');
    expect(resolveModelKey({ model: 'moonshotai/Kimi-K3' })).toBe('kimik3');
  });

  it('resolves point-release variants to their own DB key (faithful to submitted data)', () => {
    expect(resolveModelKey({ infmax_model_prefix: 'glm5.1' })).toBe('glm5.1');
    expect(resolveModelKey({ infmax_model_prefix: 'glm5.2' })).toBe('glm5.2');
    expect(resolveModelKey({ infmax_model_prefix: 'kimik2.6' })).toBe('kimik2.6');
    expect(resolveModelKey({ infmax_model_prefix: 'minimaxm2.7' })).toBe('minimaxm2.7');
    expect(resolveModelKey({ model: 'amd/GLM-5.1-MXFP4' })).toBe('glm5.1');
    expect(resolveModelKey({ model: 'zai-org/GLM-5.2-FP8' })).toBe('glm5.2');
  });
});

describe('MODEL_TO_KEY', () => {
  it('all values point to valid DB model keys', () => {
    const dbKeys = new Set(Object.keys(DB_MODEL_TO_DISPLAY));
    for (const [path, key] of Object.entries(MODEL_TO_KEY)) {
      expect(dbKeys.has(key), `MODEL_TO_KEY['${path}'] = '${key}' not in DB_MODEL_TO_DISPLAY`).toBe(
        true,
      );
    }
  });
});

describe('normalizeFramework', () => {
  it('lowercases framework name', () => {
    expect(normalizeFramework('VLLM', false)).toEqual({ framework: 'vllm', disagg: false });
    expect(normalizeFramework('SGLang', false)).toEqual({ framework: 'sglang', disagg: false });
  });

  it('normalizes sglang-disagg to mori-sglang + disagg=true', () => {
    expect(normalizeFramework('sglang-disagg', false)).toEqual({
      framework: 'mori-sglang',
      disagg: true,
    });
    expect(normalizeFramework('SGLANG-DISAGG', false)).toEqual({
      framework: 'mori-sglang',
      disagg: true,
    });
  });

  it('normalizes atom-disagg to mooncake-atom + disagg=true', () => {
    expect(normalizeFramework('atom-disagg', false)).toEqual({
      framework: 'mooncake-atom',
      disagg: true,
    });
    expect(normalizeFramework('ATOM-DISAGG', false)).toEqual({
      framework: 'mooncake-atom',
      disagg: true,
    });
  });

  it('renames dynamo-trtllm while preserving an explicit non-disagg value', () => {
    expect(normalizeFramework('dynamo-trtllm', false)).toEqual({
      framework: 'dynamo-trt',
      disagg: false,
    });
    expect(normalizeFramework('dynamo-trtllm', undefined)).toEqual({
      framework: 'dynamo-trt',
      disagg: true,
    });
  });

  it('reads disagg flag from disaggField for non-dynamo/mori frameworks', () => {
    expect(normalizeFramework('vllm', true)).toEqual({ framework: 'vllm', disagg: true });
    expect(normalizeFramework('vllm', 'True')).toEqual({ framework: 'vllm', disagg: true });
    expect(normalizeFramework('vllm', 'true')).toEqual({ framework: 'vllm', disagg: true });
    expect(normalizeFramework('vllm', false)).toEqual({ framework: 'vllm', disagg: false });
    expect(normalizeFramework('vllm', 'false')).toEqual({ framework: 'vllm', disagg: false });
    expect(normalizeFramework('vllm', null)).toEqual({ framework: 'vllm', disagg: false });
  });

  it('sglang-disagg ignores disaggField (always true)', () => {
    expect(normalizeFramework('sglang-disagg', false)).toEqual({
      framework: 'mori-sglang',
      disagg: true,
    });
  });

  it('honors explicit Dynamo disagg values and only infers true when absent', () => {
    expect(normalizeFramework('dynamo-trt', false)).toEqual({
      framework: 'dynamo-trt',
      disagg: false,
    });
    expect(normalizeFramework('dynamo-sglang', 'false')).toEqual({
      framework: 'dynamo-sglang',
      disagg: false,
    });
    expect(normalizeFramework('dynamo-vllm', true)).toEqual({
      framework: 'dynamo-vllm',
      disagg: true,
    });
    expect(normalizeFramework('dynamo-vllm', null)).toEqual({
      framework: 'dynamo-vllm',
      disagg: true,
    });
  });

  it('forces disagg=true for mori-* canonicals regardless of disaggField', () => {
    expect(normalizeFramework('mori-sglang', false)).toEqual({
      framework: 'mori-sglang',
      disagg: true,
    });
    expect(normalizeFramework('mori-sglang', null)).toEqual({
      framework: 'mori-sglang',
      disagg: true,
    });
  });

  it('does not force disagg for plain sglang or trt (framework does not imply disagg)', () => {
    expect(normalizeFramework('sglang', false)).toEqual({ framework: 'sglang', disagg: false });
    expect(normalizeFramework('trt', false)).toEqual({ framework: 'trt', disagg: false });
  });
});

describe('normalizeSpecMethod', () => {
  it('returns none for falsy values', () => {
    expect(normalizeSpecMethod(null)).toBe('none');
    expect(normalizeSpecMethod(undefined)).toBe('none');
    expect(normalizeSpecMethod('')).toBe('none');
    expect(normalizeSpecMethod(0)).toBe('none');
    expect(normalizeSpecMethod(false)).toBe('none');
  });

  it('lowercases the method name', () => {
    expect(normalizeSpecMethod('Eagle')).toBe('eagle');
    expect(normalizeSpecMethod('MEDUSA')).toBe('medusa');
  });

  it('preserves already-lowercase values', () => {
    expect(normalizeSpecMethod('eagle')).toBe('eagle');
  });
});

describe('parseBool', () => {
  it('returns true for true, "true", "True"', () => {
    expect(parseBool(true)).toBe(true);
    expect(parseBool('true')).toBe(true);
    expect(parseBool('True')).toBe(true);
  });

  it('returns false for everything else', () => {
    expect(parseBool(false)).toBe(false);
    expect(parseBool('false')).toBe(false);
    expect(parseBool('False')).toBe(false);
    expect(parseBool(null)).toBe(false);
    expect(parseBool(undefined)).toBe(false);
    expect(parseBool(0)).toBe(false);
    expect(parseBool(1)).toBe(false);
    expect(parseBool('1')).toBe(false);
    expect(parseBool('TRUE')).toBe(false);
  });
});

describe('parseOptionalBool', () => {
  it('preserves explicit true and false values', () => {
    expect(parseOptionalBool(true)).toBe(true);
    expect(parseOptionalBool('True')).toBe(true);
    expect(parseOptionalBool(false)).toBe(false);
    expect(parseOptionalBool('False')).toBe(false);
  });

  it('returns undefined for absent or unrecognized values', () => {
    expect(parseOptionalBool(null)).toBeUndefined();
    expect(parseOptionalBool(undefined)).toBeUndefined();
    expect(parseOptionalBool('TRUE')).toBeUndefined();
    expect(parseOptionalBool(1)).toBeUndefined();
  });
});

describe('parseNum', () => {
  it('parses numeric values', () => {
    expect(parseNum(42)).toBe(42);
    expect(parseNum(3.14)).toBe(3.14);
    expect(parseNum(0)).toBe(0);
  });

  it('parses numeric strings', () => {
    expect(parseNum('42')).toBe(42);
    expect(parseNum('3.14')).toBe(3.14);
    expect(parseNum('0')).toBe(0);
  });

  it('returns undefined for null/undefined', () => {
    expect(parseNum(null)).toBeUndefined();
    expect(parseNum(undefined)).toBeUndefined();
  });

  it('returns undefined for non-numeric strings', () => {
    expect(parseNum('abc')).toBeUndefined();
    expect(parseNum('')).toBeUndefined();
  });

  it('parses strings with leading numbers', () => {
    expect(parseNum('42abc')).toBe(42);
  });
});

describe('parseInt2', () => {
  it('parses integer values', () => {
    expect(parseInt2(42)).toBe(42);
    expect(parseInt2(0)).toBe(0);
  });

  it('rounds non-integer numbers', () => {
    expect(parseInt2(3.7)).toBe(4);
    expect(parseInt2(3.2)).toBe(3);
  });

  it('parses integer strings', () => {
    expect(parseInt2('42')).toBe(42);
    expect(parseInt2('0')).toBe(0);
  });

  it('truncates decimal strings to integer', () => {
    expect(parseInt2('3.7')).toBe(3); // parseInt behavior: truncates at decimal
  });

  it('returns undefined for null/undefined', () => {
    expect(parseInt2(null)).toBeUndefined();
    expect(parseInt2(undefined)).toBeUndefined();
  });

  it('returns undefined for non-numeric strings', () => {
    expect(parseInt2('abc')).toBeUndefined();
    expect(parseInt2('')).toBeUndefined();
  });
});

describe('parseIslOsl', () => {
  it('parses standard sequence lengths from filenames', () => {
    expect(parseIslOsl('Full_Sweep_-_1k1k_12345')).toEqual({ isl: 1024, osl: 1024 });
    expect(parseIslOsl('results_dsr1_1k8k_4305020262.zip')).toEqual({ isl: 1024, osl: 8192 });
    expect(parseIslOsl('eval_dsr1_8k1k_something.json')).toEqual({ isl: 8192, osl: 1024 });
  });

  it('handles hyphen separator before numbers', () => {
    expect(parseIslOsl('sweep-1k1k-12345')).toEqual({ isl: 1024, osl: 1024 });
  });

  it('returns null when no match found', () => {
    expect(parseIslOsl('no_sequence_here')).toBeNull();
    expect(parseIslOsl('')).toBeNull();
    expect(parseIslOsl('file.json')).toBeNull();
  });

  it('requires delimiters around the pattern', () => {
    // Pattern requires [_-] before and [_\-.] after
    expect(parseIslOsl('x1k1ky')).toBeNull();
  });

  it('parses larger sequences', () => {
    expect(parseIslOsl('test_32k16k_result.json')).toEqual({ isl: 32768, osl: 16384 });
  });
});

describe('GPU_KEYS re-export', () => {
  it('re-exports GPU_KEYS from constants', () => {
    expect(GPU_KEYS).toBeInstanceOf(Set);
    expect(GPU_KEYS.has('h100')).toBe(true);
  });
});
