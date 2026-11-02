import { useEffect, useState } from 'react';
import { ROLES, nomRole, peutGererMembres, rolesAssignables } from './permissions.js';

const formaterConnexion = (iso) => (iso ? new Date(iso).toLocaleString('fr-CA', { dateStyle: 'medium', timeStyle: 'short' }) : 'Jamais connecté');

function BadgeRole({ role }) {
  return <span className={'badge-role role-' + role}>{nomRole(role)}</span>;
}

// Fenêtre réservée aux administrateurs et au propriétaire : régler le rôle de chaque personne connectée au serveur.
// membres : [{ id, nom, email, role, derniereConnexion, estMoi }] ; moi : le rôle de l'utilisateur de cet ordinateur.
export default function Permissions({ moi, membres = [], serveurConnecte = false, roleParDefaut, onRoleParDefaut, onChangerRole, onRetirer, onFermer }) {
  const [recherche, setRecherche] = useState('');

  useEffect(() => {
    const touche = (e) => { if (e.key === 'Escape') onFermer(); };
    window.addEventListener('keydown', touche);
    return () => window.removeEventListener('keydown', touche);
  }, [onFermer]);

  if (!peutGererMembres(moi)) return null; // garde-fou : jamais affichée sans les droits

  const q = recherche.trim().toLowerCase();
  const visibles = membres.filter((m) => !q || m.nom.toLowerCase().includes(q) || (m.email || '').toLowerCase().includes(q));

  function retirer(m) {
    if (window.confirm(`Retirer l'accès de ${m.nom} ? Cette personne ne pourra plus ouvrir les notes du club.`)) onRetirer(m.id);
  }

  return (
    <div className="dialogue-fond" onMouseDown={onFermer}>
      <div className="dialogue permissions" onMouseDown={(e) => e.stopPropagation()}>
        <strong>👥 Permissions des membres</strong>

        {!serveurConnecte && (
          <p className="permissions-avis">Aucun serveur n'est connecté : cette fenêtre montre l'interface, mais rien n'est enregistré pour l'instant.</p>
        )}

        <div className="titre-section">Rôles</div>
        <div className="roles-legende">
          {ROLES.map((r) => (
            <div key={r.id} className="role-legende">
              <BadgeRole role={r.id} />
              <span>{r.description}</span>
            </div>
          ))}
        </div>
        <p className="aide">Un administrateur règle les lecteurs et les modificateurs ; seul le propriétaire nomme ou retire des administrateurs.</p>

        <div className="titre-section">Nouveaux membres</div>
        <div className="reglage-ligne">
          <span>Rôle donné à une personne qui se connecte pour la première fois</span>
          <select value={roleParDefaut} onChange={(e) => onRoleParDefaut(e.target.value)}>
            <option value="lecteur">Lecteur</option>
            <option value="modificateur">Modificateur</option>
          </select>
        </div>

        <div className="titre-section">Membres{membres.length > 0 ? ` (${membres.length})` : ''}</div>
        {membres.length > 0 && (
          <input className="champ" value={recherche} placeholder="Rechercher un nom ou un courriel…" onChange={(e) => setRecherche(e.target.value)} />
        )}

        <div className="membres">
          {membres.length === 0 && (
            <div className="membres-vide">
              <p>Aucun membre pour l'instant.</p>
              <p className="aide">Les personnes qui se connectent au serveur apparaîtront ici. Vous pourrez alors choisir leur rôle ou leur retirer l'accès.</p>
            </div>
          )}
          {membres.length > 0 && visibles.length === 0 && <p className="aide">Aucun membre ne correspond à la recherche.</p>}
          {visibles.map((m) => {
            const assignables = rolesAssignables(moi, m);
            const choix = ROLES.filter((r) => r.id === m.role || assignables.includes(r.id));
            return (
              <div key={m.id} className="membre-ligne">
                <span className="membre-avatar" aria-hidden="true">{(m.nom || '?').trim().charAt(0).toUpperCase()}</span>
                <span className="membre-infos">
                  <span className="membre-nom">{m.nom}{m.estMoi && <span className="aide"> (vous)</span>}</span>
                  <span className="aide">{m.email ? `${m.email} · ` : ''}{formaterConnexion(m.derniereConnexion)}</span>
                </span>
                {assignables.length > 0 ? (
                  <select value={m.role} onChange={(e) => onChangerRole(m.id, e.target.value)} aria-label={`Rôle de ${m.nom}`}>
                    {choix.map((r) => <option key={r.id} value={r.id}>{r.nom}</option>)}
                  </select>
                ) : (
                  <span title={m.estMoi ? 'Vous ne pouvez pas changer votre propre rôle' : 'Votre rôle ne permet pas de modifier cette personne'}>
                    <BadgeRole role={m.role} />
                  </span>
                )}
                <button className="membre-retirer" disabled={assignables.length === 0} onClick={() => retirer(m)} title="Retirer l'accès">×</button>
              </div>
            );
          })}
        </div>

        <div className="dialogue-boutons">
          <span style={{ flex: 1 }} />
          <button className="primaire" onClick={onFermer}>Fermer</button>
        </div>
      </div>
    </div>
  );
}
