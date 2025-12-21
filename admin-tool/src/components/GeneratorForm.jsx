import React, { useState } from 'react';
import { Upload, CheckCircle, AlertCircle, Loader2, FileDown } from 'lucide-react';
import { useDropzone } from 'react-dropzone';
const { ipcRenderer } = window.require('electron');

export default function GeneratorForm({ onSuccess }) {
    const [formData, setFormData] = useState({
        clientName: '',
        hwid: '',
        type: 'monthly',
        days: '30'
    });
    const [status, setStatus] = useState('idle'); // idle, loading, success, error
    const [message, setMessage] = useState('');

    const onDrop = async (acceptedFiles) => {
        if (acceptedFiles.length > 0) {
            const file = acceptedFiles[0];
            try {
                const data = await ipcRenderer.invoke('read-hid-file', file.path);
                if (data && data.hwid) {
                    setFormData(prev => ({
                        ...prev,
                        hwid: data.hwid,
                        clientName: prev.clientName || '' // Keep existing or empty
                    }));
                    setMessage(`Loaded HWID from ${file.name}`);
                }
            } catch (err) {
                console.error(err);
                setMessage('Failed to read file');
            }
        }
    };

    const { getRootProps, getInputProps, isDragActive } = useDropzone({
        onDrop,
        accept: { 'application/json': ['.hid', '.json'] },
        maxFiles: 1
    });

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!formData.clientName || !formData.hwid) {
            setMessage('Client Name and HWID are required');
            return;
        }

        setStatus('loading');
        try {
            const result = await ipcRenderer.invoke('generate-license', formData);
            if (result.success) {
                setStatus('success');
                setMessage(`License saved to: ${result.filePath}`);
                onSuccess();
            } else {
                setStatus('error');
                setMessage(result.error);
            }
        } catch (err) {
            setStatus('error');
            setMessage(err.message);
        }
    };

    return (
        <div className="space-y-6">
            <div>
                <h2 className="text-2xl font-bold text-white">Generate New License</h2>
                <p className="text-slate-400">Create a digitally signed license file for a client.</p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Form Section */}
                <div className="lg:col-span-2 space-y-6">
                    <div className="bg-slate-800 rounded-xl p-6 border border-slate-700 shadow-xl">
                        <form onSubmit={handleSubmit} className="space-y-4">

                            {/* HWID Dropzone */}
                            <div {...getRootProps()} className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors ${isDragActive ? 'border-blue-500 bg-blue-500/10' : 'border-slate-600 hover:border-slate-500 hover:bg-slate-700/50'}`}>
                                <input {...getInputProps()} />
                                <div className="flex flex-col items-center gap-2 text-slate-400">
                                    <Upload size={32} />
                                    {formData.hwid ? (
                                        <p className="text-green-400 font-mono text-sm">{formData.hwid}</p>
                                    ) : (
                                        <p className="text-sm">Drag & Drop <span className="text-white font-bold">.hid</span> file here or click to select</p>
                                    )}
                                </div>
                            </div>

                            {/* Manual Inputs */}
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-slate-300 mb-1">Hardware ID (HWID)</label>
                                    <input
                                        type="text"
                                        value={formData.hwid}
                                        onChange={(e) => setFormData({ ...formData, hwid: e.target.value })}
                                        placeholder="XXXX-XXXX-XXXX-XXXX"
                                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-slate-300 mb-1">Client Name</label>
                                    <input
                                        type="text"
                                        value={formData.clientName}
                                        onChange={(e) => setFormData({ ...formData, clientName: e.target.value })}
                                        placeholder="Restaurant Name or Owner"
                                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    />
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-slate-300 mb-1">License Type</label>
                                        <select
                                            value={formData.type}
                                            onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                                            className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                                        >
                                            <option value="monthly">Monthly (Subscription)</option>
                                            <option value="lifetime">Lifetime (Permanent)</option>
                                        </select>
                                    </div>

                                    {formData.type === 'monthly' && (
                                        <div>
                                            <label className="block text-sm font-medium text-slate-300 mb-1">Duration (Days)</label>
                                            <input
                                                type="number"
                                                value={formData.days}
                                                onChange={(e) => setFormData({ ...formData, days: e.target.value })}
                                                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                                            />
                                        </div>
                                    )}
                                </div>
                            </div>

                            <button
                                type="submit"
                                disabled={status === 'loading'}
                                className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 rounded-lg transition-all flex items-center justify-center gap-2 mt-4 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {status === 'loading' ? <Loader2 className="animate-spin" /> : <FileDown />}
                                Generate License File
                            </button>
                        </form>

                        {/* Status Message */}
                        {message && (
                            <div className={`mt-4 p-4 rounded-lg flex items-center gap-3 ${status === 'success' ? 'bg-green-500/10 text-green-400' : status === 'error' ? 'bg-red-500/10 text-red-400' : 'bg-slate-700/50 text-slate-300'}`}>
                                {status === 'success' && <CheckCircle size={20} />}
                                {status === 'error' && <AlertCircle size={20} />}
                                <p className="text-sm">{message}</p>
                            </div>
                        )}
                    </div>
                </div>

                {/* Info Panel */}
                <div className="space-y-4">
                    <div className="bg-gradient-to-br from-blue-600 to-indigo-700 rounded-xl p-6 text-white shadow-lg">
                        <h3 className="font-bold text-lg mb-2">Instructions</h3>
                        <ol className="list-decimal list-inside space-y-2 text-sm text-blue-100">
                            <li>Ask client to send you the <code className="bg-white/20 px-1 rounded">.hid</code> file.</li>
                            <li>Drag and drop the file into the box.</li>
                            <li>Enter the client's name.</li>
                            <li>Select duration (usually 30 days).</li>
                            <li>Click Generate.</li>
                            <li>Send the <code className="bg-white/20 px-1 rounded">.license</code> file back to client.</li>
                        </ol>
                    </div>
                </div>

            </div>
        </div>
    );
}
