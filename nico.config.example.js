// ============================================================
//  CONFIGURACIÓN DE NICO  —  edita solo este archivo
// ============================================================

module.exports = {
  // ¿Qué cerebro usa NICO?  Lo más fácil es elegirlo desde el engranaje ⚙️ dentro
  // de la app (y queda guardado). Aquí defines el valor inicial.
  //   Nube:  'gemini' · 'openai' · 'anthropic' · 'deepseek' · 'openrouter' · 'perplexity' · 'custom'
  //   Local: 'ollama' · 'lmstudio' · 'customlocal'
  PROVIDER: 'ollama',

  // ---------- GEMINI (nube) ----------  key gratis: https://aistudio.google.com/apikey
  GEMINI_API_KEY: 'PEGA_AQUI_TU_API_KEY',
  MODEL: 'gemini-2.0-flash',

  // ---------- OpenAI / ChatGPT (nube) ----------  https://platform.openai.com/api-keys
  OPENAI_API_KEY: '',
  OPENAI_MODEL: 'gpt-4o-mini',

  // ---------- Claude / Anthropic (nube) ----------  https://console.anthropic.com
  ANTHROPIC_API_KEY: '',
  ANTHROPIC_MODEL: 'claude-3-5-sonnet-latest',

  // ---------- DeepSeek (nube) ----------  https://platform.deepseek.com
  DEEPSEEK_API_KEY: '',
  DEEPSEEK_MODEL: 'deepseek-chat',

  // ---------- OpenRouter (nube, cientos de modelos) ----------  https://openrouter.ai/keys
  OPENROUTER_API_KEY: '',
  OPENROUTER_MODEL: 'openai/gpt-4o-mini',

  // ---------- Perplexity (nube) ----------  https://www.perplexity.ai/settings/api
  PERPLEXITY_API_KEY: '',
  PERPLEXITY_MODEL: 'sonar',

  // ---------- Otro servicio compatible con OpenAI (Groq, Together, Mistral, xAI…) ----------
  CUSTOM_URL: '',
  CUSTOM_API_KEY: '',
  CUSTOM_MODEL: '',

  // ---------- OLLAMA (IA local, sin internet) ----------  https://ollama.com/download
  // Instala un modelo:  ollama pull qwen2.5:7b-instruct
  OLLAMA_URL: 'http://localhost:11434',
  OLLAMA_MODEL: 'qwen2.5:7b-instruct',

  // ---------- LM Studio (IA local) ----------  https://lmstudio.ai
  // Carga un modelo y en la pestaña Developer pulsa "Start Server".
  LMSTUDIO_URL: 'http://localhost:1234/v1',
  LMSTUDIO_API_KEY: 'lm-studio',
  LMSTUDIO_MODEL: '',

  // ---------- Otro servidor local compatible con OpenAI (llama.cpp, vLLM, Jan…) ----------
  CUSTOMLOCAL_URL: 'http://localhost:8080/v1',
  CUSTOMLOCAL_API_KEY: '',
  CUSTOMLOCAL_MODEL: '',

  // Modelo de embeddings para vectorizar documentos con servicios compatibles con OpenAI.
  // (Con Gemini y Ollama NICO ya elige el suyo automáticamente.)
  EMBED_MODEL_OAI: 'text-embedding-3-small',

  // ---------- Personalidad de NICO (aplica a ambos) ----------
  SYSTEM_PROMPT: `Eres NICO, un asistente de inteligencia artificial de escritorio.

Hablas siempre en español y tienes una personalidad jovial, cercana, curiosa, inteligente y natural. Tienes sentido del humor y puedes utilizar bromas sutiles, ironía ligera o comentarios ingeniosos cuando sean apropiados, sin exagerar ni interrumpir conversaciones serias.

Adapta tu personalidad al contexto:
- Si el usuario está aprendiendo, sé paciente, didáctico y motivador.
- Si está programando o resolviendo un problema, sé preciso, práctico y directo.
- Si conversa informalmente, sé relajado, espontáneo y divertido.
- Si el tema es serio, académico o delicado, mantén un tono respetuoso y profesional.
- Si el usuario está confundido, explica las cosas de manera sencilla y sin hacerlo sentir mal.
- Si algo es interesante, demuestra curiosidad y entusiasmo moderado.

Responde de forma breve y clara por defecto. Amplía la explicación cuando el usuario lo solicite o cuando sea necesario para resolver correctamente el problema.

No inventes información. Si no sabes algo, dilo con honestidad.

Mantén el contexto de la conversación y evita repetir información innecesariamente, no uses emojis.

Tu objetivo es ser un asistente de escritorio útil, inteligente, agradable y con personalidad, haciendo que interactuar contigo se sienta natural y humano.`
};
