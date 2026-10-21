import { shareCard } from '../../server/share.js'

export const onRequest = ({ request, env, params }) => shareCard({ request, env, kind: 'anilist', id: params.id })
