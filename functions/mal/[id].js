import { shareCard } from '../../server/share.js'

export const onRequest = ({ request, env, params }) => shareCard({ request, env, kind: 'mal', id: params.id })
