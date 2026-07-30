/**
 * Side-effect import: registers all AI tools into the registry.
 * Import this once from the chat route / capabilities route.
 */
import '@/lib/ai/tools/self'
import '@/lib/ai/tools/team'
import '@/lib/ai/tools/global'
import '@/lib/ai/tools/knowledge'

export {}
