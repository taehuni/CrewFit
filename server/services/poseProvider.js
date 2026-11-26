const CONFIGURATION_CODES = new Set([
  'invalid_api_key', 'model_not_found', 'unsupported_model', 'model_not_supported',
  'insufficient_quota', 'billing_hard_limit_reached', 'billing_not_active',
]);
const probability = value => Number.isFinite(value) && value >= 0 && value <= 1;

class PoseProviderError extends Error {
  constructor(status, code, message) {super(message); this.status = status; this.code = code;}
}
const unavailable = () => new PoseProviderError(503, 'analysis_unavailable', '운동 분석 서비스의 연결 설정을 확인해야 해요. 지금은 분석을 진행할 수 없어요.');
const temporary = () => new PoseProviderError(502, 'analysis_temporary_failure', '운동 분석 서비스에 일시적으로 연결하지 못했어요. 잠시 후 다시 시도해 주세요.');
const invalidResponse = () => new PoseProviderError(502, 'analysis_invalid_response', '운동 분석 서비스에서 올바른 결과를 받지 못했어요. 분석을 잠시 멈췄어요.');

// Validate transport/schema separately from confidence. A malformed result is a
// service failure, not evidence that the user performed an unrecognizable move.
export function validatePoseDecision(data, questions) {
  if (!data || (data.status !== undefined && data.status !== 'completed') || !Array.isArray(data.answers) || data.answers.length !== questions.length) throw invalidResponse();
  for (const question of questions) {
    const answers = data.answers.filter(answer => answer?.name === question.name);
    if (answers.length !== 1) throw invalidResponse();
    const answer = answers[0];
    if (answer.type === 'refusal') continue;
    if (answer.type !== question.type) throw invalidResponse();
    if (question.type === 'predicate') {
      if (!probability(answer.probability)) throw invalidResponse();
      continue;
    }
    const values = new Set(question.choices.map(choice => choice.value));
    const distribution = answer.probabilities;
    if (!values.has(answer.choice) || !probability(answer.confidence) || !Array.isArray(distribution) || distribution.length !== values.size || new Set(distribution.map(row => row?.value)).size !== values.size || distribution.some(row => !values.has(row?.value) || !probability(row.probability)) || Math.abs(distribution.reduce((sum, row) => sum + row.probability, 0) - 1) > .02) throw invalidResponse();
  }
  return data;
}

// No provider text, request body, frames or credentials escape this boundary.
export async function requestPoseDecision({payload, key, fetchImpl = globalThis.fetch, timeoutMs = 15000}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetchImpl('https://api.openai.com/v1/decisions', {
      method: 'POST', headers: {'Content-Type': 'application/json', Authorization: `Bearer ${key}`},
      body: JSON.stringify(payload), signal: controller.signal,
    });
    if (!response.ok) {
      let providerCode;
      // Only a fixed error-code allowlist is used; never expose/log provider prose.
      try {const error = (await response.json())?.error; providerCode = error?.code || error?.type;} catch {}
      if (CONFIGURATION_CODES.has(providerCode) || (response.status >= 400 && response.status < 500 && ![408, 429].includes(response.status))) throw unavailable();
      throw temporary();
    }
    let data;
    try {data = await response.json();} catch (error) {if (controller.signal.aborted) throw temporary(); throw invalidResponse();}
    if (controller.signal.aborted) throw temporary();
    return validatePoseDecision(data, payload.questions);
  } catch (error) {
    if (error instanceof PoseProviderError) throw error;
    throw temporary();
  } finally {clearTimeout(timeout);}
}
