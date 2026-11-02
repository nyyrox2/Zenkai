import { shareCard } from '../../server/share.js'

// /watch/:id?room=zk-xxxxxx&host=Name — watch-party invites get an "<name> is inviting you" preview card
export const onRequest = ({ request, env, params }) => shareCard({ request, env, kind: 'anilist', id: params.id, party: true })
