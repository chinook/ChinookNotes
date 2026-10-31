import { createContext } from 'react';

// Les pages de l'application par identifiant : { [id]: { icone, type } }. Sert aux liens « page:ID » de l'éditeur.
export const PagesContext = createContext({});
