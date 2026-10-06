import React, { useState, useEffect } from 'react';
import { getSetting, setSetting, exportBackupData, importBackupData } from '../db';
import { DEFAULT_GEMINI_MODEL, testGeminiConnection, processPendingMessages } from '../services/gemini';
import { Settings, Key, Download, Upload, CheckCircle, AlertTriangle, RefreshCw, Activity, Loader2 } from 'lucide-react';

export const SettingsView: React.FC = () => {
  const [apiKey, setApiKey] = useState('');
  const [model, setModel] = useState(DEFAULT_GEMINI_MODEL);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [importSuccess, setImportSuccess] = useState('');

  const [testingConnection, setTestingConnection] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  useEffect(() => {
    async function loadSettings() {
      const savedKey = await getSetting('gemini_api_key', '');
      const savedModel = await getSetting('gemini_model', DEFAULT_GEMINI_MODEL);
      setApiKey(savedKey);
      setModel(savedModel);
    }
    loadSettings();
  }, []);

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSavedSuccess(false);

    try {
      await setSetting('gemini_api_key', apiKey.trim());
      await setSetting('gemini_model', model);
      setSavedSuccess(true);
      processPendingMessages();
      setTimeout(() => setSavedSuccess(false), 3000);
    } catch (err: any) {
      setErrorMsg(err.message || 'Error guardando ajustes');
    }
  };

  const handleTestConnection = async () => {
    setTestingConnection(true);
    setTestResult(null);
    setErrorMsg('');

    const res = await testGeminiConnection(apiKey, model);
    setTestingConnection(false);

    if (res.success) {
      setTestResult({
        success: true,
        message: '¡Conexión exitosa con la API de Gemini!'
      });
    } else {
      setTestResult({
        success: false,
        message: res.error || 'No se pudo conectar con la API de Gemini.'
      });
    }
  };

  const handleExportBackup = async () => {
    try {
      const backupData = await exportBackupData();
      const jsonString = `data:text/json;charset=utf-8,${encodeURIComponent(
        JSON.stringify(backupData, null, 2)
      )}`;
      const downloadAnchor = document.createElement('a');
      downloadAnchor.setAttribute('href', jsonString);
      downloadAnchor.setAttribute(
        'download',
        `fergis_backup_${new Date().toISOString().slice(0, 10)}.json`
      );
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();
    } catch (err: any) {
      setErrorMsg('Error al exportar la copia de seguridad.');
    }
  };

  const handleImportBackup = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const json = JSON.parse(event.target?.result as string);
        if (
          window.confirm(
            '¿Deseas restaurar esta copia de seguridad? Se reemplazarán las notas y el grafo actual.'
          )
        ) {
          await importBackupData(json);
          setImportSuccess('Copia de seguridad restaurada con éxito.');
          setTimeout(() => {
            setImportSuccess('');
            window.location.reload();
          }, 1500);
        }
      } catch (err: any) {
        setErrorMsg('El archivo seleccionado no es un JSON de copia de seguridad válido.');
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="flex flex-col h-full bg-gradient-to-b from-amber-50/40 via-amber-50/20 to-stone-50 pb-24 overflow-y-auto">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-white/80 backdrop-blur-md px-4 py-3 border-b border-amber-200/60 shadow-xs flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Settings className="w-5 h-5 text-amber-700" />
          <h1 className="text-base font-bold text-stone-800">Ajustes & Configuración</h1>
        </div>
      </div>

      <div className="p-4 space-y-6 max-w-md mx-auto w-full">
        {/* Gemini API Key Configuration Card */}
        <div className="bg-white border border-amber-200 rounded-2xl p-4 shadow-xs space-y-4">
          <div className="flex items-center gap-2 text-stone-800 font-bold border-b border-stone-100 pb-2">
            <Key className="w-4 h-4 text-amber-600" />
            <h2>API Key de Gemini (Google AI Studio)</h2>
          </div>

          <p className="text-xs text-stone-600 leading-relaxed">
            Ingresa tu clave de API de Google AI Studio para que Gemini pueda analizar y clasificar tus escritos en el grafo de forma inteligente.
          </p>

          <form onSubmit={handleSaveSettings} className="space-y-3">
            <div>
              <label className="block text-xs font-semibold text-stone-700 mb-1">
                API Key
              </label>
              <input
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="AIzaSy..."
                className="w-full px-3 py-2 text-xs bg-stone-50 border border-stone-200 rounded-xl focus:outline-hidden focus:border-amber-500 font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-stone-700 mb-1">
                Modelo de Gemini
              </label>
              <select
                value={model}
                onChange={(e) => setModel(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-stone-50 border border-stone-200 rounded-xl focus:outline-hidden focus:border-amber-500 text-stone-800 font-medium"
              >
                <option value="gemini-2.5-flash">Gemini 2.5 Flash (Recomendado / Rápido)</option>
                <option value="gemini-2.5-pro">Gemini 2.5 Pro (Capacidad media / Avanzado)</option>
                <option value="gemini-1.5-flash">Gemini 1.5 Flash</option>
              </select>
            </div>

            {savedSuccess && (
              <div className="p-2.5 bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs rounded-xl flex items-center gap-1.5">
                <CheckCircle className="w-4 h-4 shrink-0" />
                <span>Configuración guardada correctamente.</span>
              </div>
            )}

            {testResult && (
              <div
                className={`p-2.5 text-xs rounded-xl flex items-center gap-1.5 border ${
                  testResult.success
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                    : 'bg-rose-50 border-rose-200 text-rose-700'
                }`}
              >
                {testResult.success ? (
                  <CheckCircle className="w-4 h-4 shrink-0 text-emerald-600" />
                ) : (
                  <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600" />
                )}
                <span>{testResult.message}</span>
              </div>
            )}

            {errorMsg && (
              <div className="p-2.5 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            <div className="grid grid-cols-2 gap-2 pt-1">
              <button
                type="button"
                onClick={handleTestConnection}
                disabled={testingConnection}
                className="py-2.5 px-3 bg-stone-100 hover:bg-stone-200 text-stone-800 font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 transition-all disabled:opacity-50"
              >
                {testingConnection ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin text-amber-600" />
                    <span>Probando...</span>
                  </>
                ) : (
                  <>
                    <Activity className="w-4 h-4 text-amber-600" />
                    <span>Probar conexión</span>
                  </>
                )}
              </button>

              <button
                type="submit"
                className="py-2.5 px-3 bg-amber-500 hover:bg-amber-600 text-stone-950 font-bold text-xs rounded-xl transition-all shadow-xs flex items-center justify-center"
              >
                Guardar Configuración
              </button>
            </div>
          </form>
        </div>

        {/* Backup & Restore JSON Card */}
        <div className="bg-white border border-amber-200 rounded-2xl p-4 shadow-xs space-y-3">
          <div className="flex items-center gap-2 text-stone-800 font-bold border-b border-stone-100 pb-2">
            <RefreshCw className="w-4 h-4 text-amber-600" />
            <h2>Copia de Seguridad (JSON)</h2>
          </div>

          <p className="text-xs text-stone-600 leading-relaxed">
            Puedes descargar una copia de respaldo completa con tus notas, favoritos, nodos y grafo para guardarla o transferirla a otro dispositivo.
          </p>

          {importSuccess && (
            <div className="p-2.5 bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs rounded-xl flex items-center gap-1.5">
              <CheckCircle className="w-4 h-4 shrink-0" />
              <span>{importSuccess}</span>
            </div>
          )}

          <div className="grid grid-cols-2 gap-2 pt-1">
            <button
              onClick={handleExportBackup}
              className="py-2.5 px-3 bg-amber-100 hover:bg-amber-200 text-amber-900 font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 transition-all"
            >
              <Download className="w-4 h-4" /> Exportar JSON
            </button>

            <label className="py-2.5 px-3 bg-stone-100 hover:bg-stone-200 text-stone-800 font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 transition-all cursor-pointer">
              <Upload className="w-4 h-4" /> Restaurar JSON
              <input
                type="file"
                accept=".json"
                onChange={handleImportBackup}
                className="hidden"
              />
            </label>
          </div>
        </div>
      </div>
    </div>
  );
};
