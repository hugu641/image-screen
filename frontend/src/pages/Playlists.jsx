import React, { useState, useEffect } from 'react';
import Layout from '../layouts/Layout';
import { api, mediaUrl } from '../services/api';
import {
  PlaySquare,
  Plus,
  Trash2,
  Copy,
  Edit,
  ArrowUp,
  ArrowDown,
  X,
  PlusCircle,
  Clock,
  Shuffle,
  Repeat
} from 'lucide-react';

export default function Playlists() {
  const [playlists, setPlaylists] = useState([]);
  const [library, setLibrary] = useState([]);
  const [loading, setLoading] = useState(true);

  // Modal / Form state
  const [activePlaylist, setActivePlaylist] = useState(null); // Playlist being edited
  const [playlistForm, setPlaylistForm] = useState({
    name: '',
    duration: 5,
    transition: 'fade',
    random_order: false,
    loop_playback: true
  });
  const [selectedMediaIds, setSelectedMediaIds] = useState([]); // Array of IDs in order
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [formError, setFormError] = useState('');

  const fetchPlaylists = async () => {
    try {
      const data = await api.get('/playlists');
      setPlaylists(data);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchLibrary = async () => {
    try {
      const data = await api.get('/media');
      setLibrary(data);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    async function init() {
      await Promise.all([fetchPlaylists(), fetchLibrary()]);
      setLoading(false);
    }
    init();
  }, []);

  const handleCreateOpen = () => {
    setPlaylistForm({
      name: '',
      duration: 5,
      transition: 'fade',
      random_order: false,
      loop_playback: true
    });
    setFormError('');
    setIsCreateOpen(true);
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    setFormError('');

    if (!playlistForm.name.trim()) {
      setFormError('Le nom de la playlist est obligatoire.');
      return;
    }

    try {
      const newPlaylist = await api.post('/playlists', {
        ...playlistForm,
        mediaIds: []
      });
      setIsCreateOpen(false);
      fetchPlaylists();
      // Open immediately for editing media
      openEditPanel(newPlaylist);
    } catch (err) {
      setFormError(err.message || 'Erreur lors de la création.');
    }
  };

  const openEditPanel = async (playlist) => {
    setLoading(true);
    try {
      const details = await api.get(`/playlists/${playlist.id}`);
      setActivePlaylist(details);
      setPlaylistForm({
        name: details.name,
        duration: details.duration,
        transition: details.transition,
        random_order: details.random_order === 1,
        loop_playback: details.loop_playback === 1
      });
      setSelectedMediaIds(details.media.map(m => m.id));
    } catch (err) {
      alert(err.message || 'Erreur lors de la récupération des détails.');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdate = async (e) => {
    if (e) e.preventDefault();
    if (!activePlaylist) return;

    try {
      await api.put(`/playlists/${activePlaylist.id}`, {
        ...playlistForm,
        mediaIds: selectedMediaIds
      });
      fetchPlaylists();
      // Reload active to get correct display
      const updated = await api.get(`/playlists/${activePlaylist.id}`);
      setActivePlaylist(updated);
      alert('Playlist enregistrée avec succès !');
    } catch (err) {
      alert(err.message || 'Erreur lors de la mise à jour.');
    }
  };

  const handleDelete = async (id, name) => {
    if (!window.confirm(`Voulez-vous vraiment supprimer la playlist "${name}" ?`)) {
      return;
    }

    try {
      await api.delete(`/playlists/${id}`);
      fetchPlaylists();
      if (activePlaylist?.id === id) {
        setActivePlaylist(null);
      }
    } catch (err) {
      alert(err.message || 'Erreur lors de la suppression.');
    }
  };

  const handleDuplicate = async (id) => {
    try {
      const copy = await api.post(`/playlists/${id}/duplicate`);
      fetchPlaylists();
      openEditPanel(copy);
    } catch (err) {
      alert(err.message || 'Erreur lors de la duplication.');
    }
  };

  // Media addition / ordering helpers
  const addMediaToPlaylist = (mediaId) => {
    setSelectedMediaIds(prev => [...prev, mediaId]);
  };

  const removeMediaFromPlaylist = (index) => {
    setSelectedMediaIds(prev => prev.filter((_, i) => i !== index));
  };

  const moveItem = (index, direction) => {
    const nextIndex = index + direction;
    if (nextIndex < 0 || nextIndex >= selectedMediaIds.length) return;

    setSelectedMediaIds(prev => {
      const copy = [...prev];
      const temp = copy[index];
      copy[index] = copy[nextIndex];
      copy[nextIndex] = temp;
      return copy;
    });
  };

  // Get full media detail from library for reordering listing
  const getMediaDetails = (id) => {
    return library.find(m => m.id === id);
  };

  return (
    <Layout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-white">Playlists</h1>
            <p className="text-slate-400 text-sm">Créez et configurez des boucles de diffusion.</p>
          </div>
          <button
            onClick={handleCreateOpen}
            className="px-4 py-2 bg-brand-500 hover:bg-brand-600 active:scale-[0.98] text-white font-semibold text-xs rounded-lg shadow-lg shadow-brand-500/20 transition-all flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Créer une playlist
          </button>
        </div>

        {/* Core Layout Split */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
          {/* Playlists list: Left 1/3 (or 2/3 if no active) */}
          <div className={`space-y-4 ${activePlaylist ? 'lg:col-span-1' : 'lg:col-span-3 grid grid-cols-1 md:grid-cols-3 gap-6'}`}>
            {playlists.length === 0 ? (
              <div className="glass-card rounded-2xl py-12 text-center text-slate-500 text-sm col-span-3">
                Aucune playlist. Cliquez sur "Créer une playlist" pour commencer.
              </div>
            ) : (
              playlists.map((pl) => (
                <div
                  key={pl.id}
                  onClick={() => openEditPanel(pl)}
                  className={`glass-card rounded-2xl p-5 cursor-pointer border hover:border-slate-700 transition-all ${
                    activePlaylist?.id === pl.id ? 'border-brand-500/80 bg-brand-500/5' : 'border-slate-850'
                  }`}
                >
                  <div className="flex justify-between items-start gap-4">
                    <div className="min-w-0">
                      <h3 className="font-semibold text-slate-200 truncate">{pl.name}</h3>
                      <p className="text-xs text-slate-500 font-medium mt-1">
                        {pl.media_count} médias — {pl.duration}s par défaut
                      </p>
                      <span className="inline-block mt-3 text-[10px] uppercase font-bold tracking-wider text-brand-400 bg-brand-500/10 px-2 py-0.5 rounded">
                        Transition : {pl.transition}
                      </span>
                    </div>

                    <div className="flex gap-1 shrink-0">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDuplicate(pl.id);
                        }}
                        className="p-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-300"
                        title="Dupliquer"
                      >
                        <Copy className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDelete(pl.id, pl.name);
                        }}
                        className="p-1.5 rounded-lg bg-rose-950/80 hover:bg-rose-900 text-rose-400"
                        title="Supprimer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Edit Panel: Right 2/3 (only visible if activePlaylist selected) */}
          {activePlaylist && (
            <div className="lg:col-span-2 glass-card rounded-2xl p-6 border border-slate-800 space-y-6">
              {/* Panel Header */}
              <div className="flex justify-between items-center pb-4 border-b border-slate-800">
                <div className="flex items-center gap-2">
                  <PlaySquare className="w-5 h-5 text-brand-500" />
                  <h2 className="text-base font-semibold text-white truncate max-w-[200px]">
                    Modifier : {playlistForm.name}
                  </h2>
                </div>
                <button
                  onClick={() => setActivePlaylist(null)}
                  className="text-slate-400 hover:text-white"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Playlist Form Parameters */}
              <form onSubmit={handleUpdate} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">
                    Nom de la playlist
                  </label>
                  <input
                    type="text"
                    required
                    value={playlistForm.name}
                    onChange={(e) => setPlaylistForm({ ...playlistForm, name: e.target.value })}
                    className="w-full px-3 py-2 text-xs rounded-lg glass-input"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">
                    Transition par défaut
                  </label>
                  <select
                    value={playlistForm.transition}
                    onChange={(e) => setPlaylistForm({ ...playlistForm, transition: e.target.value })}
                    className="w-full px-3 py-2 text-xs rounded-lg glass-input"
                  >
                    <option value="fade">Fondu (Fade)</option>
                    <option value="zoom">Zoom</option>
                    <option value="slide">Slide (Glissement)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1 flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5" />
                    Durée d'affichage par défaut (secondes)
                  </label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={playlistForm.duration}
                    onChange={(e) => setPlaylistForm({ ...playlistForm, duration: parseInt(e.target.value) })}
                    className="w-full px-3 py-2 text-xs rounded-lg glass-input"
                  />
                </div>

                {/* Option Toggles */}
                <div className="flex gap-6 items-center pt-5">
                  <label className="flex items-center gap-2.5 cursor-pointer text-xs font-semibold text-slate-300">
                    <input
                      type="checkbox"
                      checked={playlistForm.random_order}
                      onChange={(e) => setPlaylistForm({ ...playlistForm, random_order: e.target.checked })}
                      className="rounded bg-dark-900 border-slate-700 text-brand-500 focus:ring-0 focus:ring-offset-0 w-4 h-4"
                    />
                    <Shuffle className="w-3.5 h-3.5 text-slate-400" />
                    Ordre aléatoire
                  </label>

                  <label className="flex items-center gap-2.5 cursor-pointer text-xs font-semibold text-slate-300">
                    <input
                      type="checkbox"
                      checked={playlistForm.loop_playback}
                      onChange={(e) => setPlaylistForm({ ...playlistForm, loop_playback: e.target.checked })}
                      className="rounded bg-dark-900 border-slate-700 text-brand-500 focus:ring-0 focus:ring-offset-0 w-4 h-4"
                    />
                    <Repeat className="w-3.5 h-3.5 text-slate-400" />
                    Lecture en boucle
                  </label>
                </div>
              </form>

              {/* Media Assignment Area */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-slate-800">
                {/* 1. Playlist Content (Reordering) */}
                <div className="space-y-3">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                    Contenu de la Playlist ({selectedMediaIds.length})
                  </h3>

                  <div className="border border-slate-800 bg-dark-950/60 rounded-xl p-3 space-y-2 max-h-[350px] overflow-y-auto min-h-[150px]">
                    {selectedMediaIds.length === 0 ? (
                      <div className="py-12 text-center text-slate-500 text-xs">
                        Aucun média dans cette playlist. Ajoutez-en depuis la bibliothèque à droite.
                      </div>
                    ) : (
                      selectedMediaIds.map((id, index) => {
                        const m = getMediaDetails(id);
                        if (!m) return null;
                        return (
                          <div
                            key={`${id}-${index}`}
                            className="flex items-center justify-between gap-3 p-2 bg-slate-900/60 border border-slate-850 rounded-lg"
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <img
                                src={mediaUrl(m.filepath)}
                                alt=""
                                className="w-8 h-8 object-cover rounded shrink-0 bg-black"
                              />
                              <span className="text-xs font-semibold text-slate-200 truncate max-w-[100px]">
                                {m.original_name}
                              </span>
                            </div>

                            <div className="flex items-center gap-1 shrink-0">
                              <button
                                type="button"
                                onClick={() => moveItem(index, -1)}
                                disabled={index === 0}
                                className="p-1 rounded bg-slate-800 hover:bg-slate-750 text-slate-400 disabled:opacity-30"
                              >
                                <ArrowUp className="w-3 h-3" />
                              </button>
                              <button
                                type="button"
                                onClick={() => moveItem(index, 1)}
                                disabled={index === selectedMediaIds.length - 1}
                                className="p-1 rounded bg-slate-800 hover:bg-slate-750 text-slate-400 disabled:opacity-30"
                              >
                                <ArrowDown className="w-3 h-3" />
                              </button>
                              <button
                                type="button"
                                onClick={() => removeMediaFromPlaylist(index)}
                                className="p-1 rounded bg-rose-950/40 hover:bg-rose-900/40 text-rose-400 ml-1"
                              >
                                <X className="w-3 h-3" />
                              </button>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>

                {/* 2. Media Library Picker */}
                <div className="space-y-3">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                    Médiathèque (Cliquez pour ajouter)
                  </h3>

                  <div className="border border-slate-800 bg-dark-950/60 rounded-xl p-3 space-y-2 max-h-[350px] overflow-y-auto">
                    {library.length === 0 ? (
                      <div className="py-12 text-center text-slate-500 text-xs">
                        La bibliothèque est vide. Chargez des fichiers dans l'onglet Médiathèque.
                      </div>
                    ) : (
                      library.map((m) => (
                        <div
                          key={m.id}
                          onClick={() => addMediaToPlaylist(m.id)}
                          className="flex items-center justify-between gap-3 p-2 bg-slate-900/30 hover:bg-slate-900/80 border border-slate-850 hover:border-slate-755 rounded-lg cursor-pointer transition-all"
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <img
                              src={mediaUrl(m.filepath)}
                              alt=""
                              className="w-8 h-8 object-cover rounded shrink-0 bg-black"
                            />
                            <span className="text-xs font-semibold text-slate-300 truncate">
                              {m.original_name}
                            </span>
                          </div>
                          <PlusCircle className="w-4 h-4 text-brand-500 shrink-0" />
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex justify-end gap-3 pt-4 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => openEditPanel(activePlaylist)}
                  className="px-4 py-2 border border-slate-800 hover:bg-slate-850 rounded-lg text-xs font-semibold text-slate-400"
                >
                  Réinitialiser
                </button>
                <button
                  type="button"
                  onClick={() => handleUpdate()}
                  className="px-4 py-2 bg-brand-500 hover:bg-brand-600 rounded-lg text-xs font-semibold text-white shadow-lg shadow-brand-500/20 active:scale-[0.98] transition-all"
                >
                  Enregistrer les modifications
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Create Playlist Modal */}
        {isCreateOpen && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-dark-900 border border-slate-800 w-full max-w-md rounded-2xl p-6 relative">
              <button
                onClick={() => setIsCreateOpen(false)}
                className="absolute top-4 right-4 text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>

              <h3 className="text-base font-semibold text-white mb-4">Créer une playlist</h3>

              {formError && (
                <div className="mb-4 text-xs text-rose-400 bg-rose-500/10 border border-rose-500/20 p-2.5 rounded-lg">
                  {formError}
                </div>
              )}

              <form onSubmit={handleCreate} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1.5">
                    Nom de la playlist
                  </label>
                  <input
                    type="text"
                    required
                    value={playlistForm.name}
                    onChange={(e) => setPlaylistForm({ ...playlistForm, name: e.target.value })}
                    className="w-full px-3 py-2 text-xs rounded-lg glass-input"
                    placeholder="Ex: Diapos Hall d'entrée"
                  />
                </div>

                <div className="flex justify-end gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setIsCreateOpen(false)}
                    className="px-4 py-2 border border-slate-800 hover:bg-slate-855 rounded-lg text-xs font-semibold text-slate-400"
                  >
                    Annuler
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-brand-500 hover:bg-brand-600 rounded-lg text-xs font-semibold text-white"
                  >
                    Créer
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
