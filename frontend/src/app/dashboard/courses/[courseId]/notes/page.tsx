"use client";

import React, { useState, useEffect } from "react";
import TopNav from "@/components/layout/TopNav";
import { motion, AnimatePresence } from "framer-motion";
import { useParams } from "next/navigation";
import { 
  BookOpen, 
  FileText, 
  Download, 
  File, 
  UploadCloud, 
  Loader2,
  AlertCircle,
  Trash2,
  Edit3,
  X,
  Plus
} from "lucide-react";
import { api } from "@/lib/api";
import { getAuthUser } from "@/lib/auth";

interface MaterialItem {
  title: string;
  url: string;
  type: string;
}

interface TopicItem {
  _id: string;
  title: string;
  description?: string;
  materials: MaterialItem[];
}

export default function CourseNotes() {
  const params = useParams();
  const courseId = params.courseId as string;

  const [isTeacher, setIsTeacher] = useState(false);
  const [loading, setLoading] = useState(true);
  const [topics, setTopics] = useState<TopicItem[]>([]);

  // Modals for Teacher
  const [showTopicModal, setShowTopicModal] = useState(false);
  const [topicTitle, setTopicTitle] = useState("");
  const [topicDesc, setTopicDesc] = useState("");
  
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [selectedTopicName, setSelectedTopicName] = useState("");
  const [editingTopicId, setEditingTopicId] = useState<string | null>(null);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    const auth = getAuthUser();
    if (!auth) return;
    
    const loadData = async () => {
      setLoading(true);
      try {
        // Fetch course details and topics in parallel
        const [courseRes, topicsRes] = await Promise.all([
           api.get(`/courses/${courseId}`).catch(() => null),
           api.get(`/courses/${courseId}/topics`).catch(() => ({ data: [] }))
        ]);
        
        const courseData = courseRes?.data;
        if (courseData) {
          // Ownership check: matches teacher_id OR matches the user's profile if they are a teacher
          if (courseData.teacher_id === auth.id || auth.role === "teacher") {
            setIsTeacher(true);
          }
        } else if (auth.role === "teacher") {
           // Fallback for role-based access if course details are elusive
           setIsTeacher(true);
        }

        setTopics(topicsRes.data || []);
      } catch (e) {
        console.error("Notes loadData error:", e);
      } finally {
        setLoading(false);
      }
    };

    if (courseId) {
      loadData();
    }
  }, [courseId]);

  const handleCreateTopic = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!topicTitle.trim()) return;
    try {
      if (editingTopicId) {
        await api.put(`/courses/${courseId}/topics/${editingTopicId}`, {
            title: topicTitle.trim(),
            description: topicDesc.trim() || ""
        });
      } else {
        await api.post(`/courses/${courseId}/topics`, {
            title: topicTitle.trim(),
            description: topicDesc.trim() || ""
        });
      }
      setShowTopicModal(false);
      setEditingTopicId(null);
      setTopicTitle("");
      setTopicDesc("");
      const res = await api.get(`/courses/${courseId}/topics`);
      setTopics(res.data || []);
    } catch (e) { console.error(e); }
  };

  const handleDeleteTopic = async (topicId: string) => {
    if (!window.confirm("Are you sure you want to delete this topic and all its materials?")) return;
    try {
      await api.delete(`/courses/${courseId}/topics/${topicId}`);
      const res = await api.get(`/courses/${courseId}/topics`);
      setTopics(res.data || []);
    } catch (e) { console.error(e); }
  };

  const handleDeleteMaterial = async (topicId: string, index: number) => {
    if (!window.confirm("Delete this material?")) return;
    try {
      await api.delete(`/courses/${courseId}/topics/${topicId}/materials/${index}`);
      const res = await api.get(`/courses/${courseId}/topics`);
      setTopics(res.data || []);
    } catch (e) { console.error(e); }
  };

  const openEditModal = (topic: TopicItem) => {
    setEditingTopicId(topic._id);
    setTopicTitle(topic.title);
    setTopicDesc(topic.description || "");
    setShowTopicModal(true);
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!uploadFile || !selectedTopicName.trim()) return;

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", uploadFile);
      formData.append("topic_name", selectedTopicName.trim());
      
      await api.post(`/courses/${courseId}/materials/upload-by-topic`, formData, {
        headers: { "Content-Type": "multipart/form-data" }
      });
      
      setShowUploadModal(false);
      setUploadFile(null);
      setSelectedTopicName("");
      const res = await api.get(`/courses/${courseId}/topics`);
      setTopics(res.data || []);
    } catch (e) { 
      console.error(e); 
      alert("Upload failed. Please try again.");
    } finally { 
      setUploading(false); 
    }
  };

  return (
    <div className="flex flex-col h-full overflow-y-auto bg-gray-50 border-t border-gray-100">
      <TopNav title="Class Notes" />
      <main className="flex-1 p-6 lg:p-8 max-w-6xl mx-auto w-full">
        
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8">
            <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-amber-100 text-amber-600 rounded-xl flex items-center justify-center shadow-sm">
                    <BookOpen className="w-6 h-6" />
                </div>
                <div>
                   <h2 className="text-2xl font-black text-gray-900 tracking-tight">Class Materials</h2>
                   <p className="text-sm font-medium text-gray-500">Access slides, transcripts, and reading materials.</p>
                </div>
            </div>

            <div className="flex items-center gap-3 w-full md:w-auto">
                {isTeacher && (
                   <div className="flex gap-2">
                       <button 
                         onClick={() => setShowTopicModal(true)}
                         className="flex items-center gap-2 px-4 py-2 bg-slate-900 text-white rounded-lg text-sm font-bold transition-colors shadow-sm"
                       >
                          <Plus className="w-4 h-4" /> New Topic
                       </button>
                       <button 
                         onClick={() => setShowUploadModal(true)}
                         className="flex items-center gap-2 px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-sm font-bold transition-colors shadow-sm"
                       >
                          <UploadCloud className="w-4 h-4" /> Upload Note
                       </button>
                   </div>
                )}
            </div>
        </div>

        {/* Content */}
        {loading ? (
             <div className="p-10 text-center text-gray-500 font-bold flex items-center justify-center gap-2">
                 <Loader2 className="w-5 h-5 animate-spin"/> Loading class materials...
             </div>
        ) : topics.length === 0 ? (
            <div className="py-20 text-center border-2 border-dashed border-gray-100 rounded-3xl bg-white shadow-sm">
                <BookOpen className="w-16 h-16 text-gray-200 mx-auto mb-4" />
                <h3 className="text-xl font-bold text-gray-900 mb-2">No educational materials yet.</h3>
                <p className="text-gray-500 max-w-sm mx-auto">
                    {isTeacher ? "Get started by creating your first Topic and uploading PDFs or transcripts." : "Your teacher has not uploaded any materials for this classroom yet."}
                </p>
            </div>
        ) : (
            <div className="space-y-8">
                {topics.map((topic) => (
                    <div key={topic._id} className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
                        <div className="px-8 py-6 border-b border-gray-50 bg-gray-50/50 flex justify-between items-start">
                            <div>
                                <h3 className="text-lg font-black text-gray-900 tracking-tight flex items-center gap-2">
                                    <FileText className="w-5 h-5 text-amber-500" />
                                    {topic.title}
                                </h3>
                                {topic.description && (
                                    <p className="text-sm text-gray-500 mt-1 font-medium">{topic.description}</p>
                                )}
                            </div>
                            {isTeacher && (
                                <div className="flex gap-2">
                                    <button 
                                        onClick={() => openEditModal(topic)}
                                        className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                        title="Edit Topic"
                                    >
                                        <Edit3 className="w-4 h-4" />
                                    </button>
                                    <button 
                                        onClick={() => handleDeleteTopic(topic._id)}
                                        className="p-2 text-gray-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                                        title="Delete Topic"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </div>
                            )}
                        </div>
                        <div className="p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {topic.materials && topic.materials.map((m, idx) => {
                                // Sanitize URL to handle port changes (8000 -> 8001)
                                const sanitizedUrl = m.url.replace(':8000/', ':8001/');
                                
                                return (
                                    <div key={idx} className="relative group">
                                        <motion.a
                                            href={sanitizedUrl}
                                            target="_blank"
                                            whileHover={{ scale: 1.02 }}
                                            className="block p-4 rounded-2xl border border-gray-50 bg-white hover:border-amber-100 hover:bg-amber-50/30 transition-all"
                                        >
                                        <div className="flex items-center justify-between mb-3">
                                            <div className={`p-2.5 rounded-xl ${m.type === 'pdf' ? 'bg-rose-50 text-rose-500' : 'bg-blue-50 text-blue-500'}`}>
                                                {m.type === 'pdf' ? <FileText className="w-5 h-5" /> : <BookOpen className="w-5 h-5" />}
                                            </div>
                                            <div className="p-2 rounded-full opacity-0 group-hover:opacity-100 transition-opacity">
                                                <Download className="w-4 h-4 text-gray-400 group-hover:text-amber-600" />
                                            </div>
                                        </div>
                                        <h4 className="font-bold text-gray-900 text-sm line-clamp-1 mb-1">{m.title}</h4>
                                        <div className="flex items-center gap-2 mt-2">
                                            <span className="text-[10px] font-black uppercase tracking-widest text-gray-400 px-2 py-0.5 rounded bg-gray-50 border border-gray-100 capitalize">
                                                {m.type}
                                            </span>
                                        </div>
                                    </motion.a>
                                    {isTeacher && (
                                        <button 
                                            onClick={(e) => { e.preventDefault(); handleDeleteMaterial(topic._id, idx); }}
                                            className="absolute top-2 right-2 p-1.5 bg-white shadow-sm border border-gray-100 rounded-full text-gray-400 hover:text-rose-600 opacity-0 group-hover:opacity-100 transition-all z-10"
                                            title="Delete Material"
                                        >
                                            <X className="w-3 h-3" />
                                        </button>
                                    )}
                                </div>
                                );
                            })}
                            {(!topic.materials || topic.materials.length === 0) && (
                                <p className="col-span-full py-4 text-center text-xs font-bold text-gray-300 italic">No files in this topic.</p>
                            )}
                        </div>
                    </div>
                ))}
            </div>
        )}

        {/* Create Topic Modal */}
        <AnimatePresence>
            {showTopicModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                    <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="bg-white rounded-3xl p-8 max-w-md w-full shadow-2xl">
                        <div className="flex items-center justify-between mb-6">
                            <h3 className="text-xl font-black">{editingTopicId ? "Update Topic" : "Create New Topic"}</h3>
                            <button onClick={() => { setShowTopicModal(false); setEditingTopicId(null); setTopicTitle(""); setTopicDesc(""); }} className="p-1 hover:bg-gray-100 rounded-full transition-colors">
                                <Plus className="w-5 h-5 text-gray-400 rotate-45" />
                            </button>
                        </div>
                        <form onSubmit={handleCreateTopic} className="space-y-4">
                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-1.5">Topic Title</label>
                                <input 
                                    type="text" 
                                    value={topicTitle}
                                    onChange={(e) => setTopicTitle(e.target.value)}
                                    className="w-full p-4 border-2 border-gray-100 rounded-xl outline-none focus:border-amber-500 transition-colors" 
                                    placeholder="e.g. Unit 1: Neural Networks"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-1.5">Description</label>
                                <textarea 
                                    value={topicDesc}
                                    onChange={(e) => setTopicDesc(e.target.value)}
                                    className="w-full p-4 border-2 border-gray-100 rounded-xl outline-none focus:border-amber-500 transition-colors h-24 resize-none" 
                                    placeholder="Briefly describe what this topic covers..."
                                />
                            </div>
                            <div className="flex justify-end gap-3 pt-4">
                                <button type="button" onClick={() => { setShowTopicModal(false); setEditingTopicId(null); setTopicTitle(""); setTopicDesc(""); }} className="px-6 py-3 font-bold text-gray-500 hover:bg-gray-100 rounded-xl transition-colors">Cancel</button>
                                <button type="submit" className="px-8 py-3 bg-slate-900 text-white font-black rounded-xl hover:bg-slate-800 transition-colors">
                                    {editingTopicId ? "Update Topic" : "Create Topic"}
                                </button>
                            </div>
                        </form>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>

        {/* Upload Material Modal */}
        <AnimatePresence>
            {showUploadModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                    <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="bg-white rounded-3xl p-8 max-w-md w-full shadow-2xl">
                        <div className="flex items-center justify-between mb-6">
                            <h3 className="text-xl font-black">Upload Educational PDF</h3>
                            <button onClick={() => setShowUploadModal(false)} className="p-1 hover:bg-gray-100 rounded-full transition-colors">
                                <Plus className="w-5 h-5 text-gray-400 rotate-45" />
                            </button>
                        </div>
                        <form onSubmit={handleUpload} className="space-y-4">
                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-1.5">Topic Name</label>
                                <input 
                                    type="text" 
                                    list="existing-topics"
                                    value={selectedTopicName}
                                    onChange={(e) => setSelectedTopicName(e.target.value)}
                                    className="w-full p-4 border-2 border-gray-100 rounded-xl outline-none focus:border-amber-500 transition-colors bg-white font-bold"
                                    placeholder="Type a new or existing topic..."
                                />
                                <datalist id="existing-topics">
                                    {topics.map(t => <option key={t._id} value={t.title} />)}
                                </datalist>
                                <p className="mt-1 text-[10px] text-gray-400 font-medium italic">Type a new name to auto-create a topic.</p>
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-1.5">PDF File</label>
                                <input 
                                    type="file" 
                                    accept=".pdf"
                                    onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
                                    className="w-full p-4 border-2 border-dashed border-gray-200 rounded-xl outline-none hover:border-amber-500 transition-colors" 
                                />
                            </div>
                            <div className="flex justify-end gap-3 pt-4">
                                <button type="button" onClick={() => setShowUploadModal(false)} className="px-6 py-3 font-bold text-gray-500 hover:bg-gray-100 rounded-xl transition-colors">Cancel</button>
                                <button 
                                    type="submit" 
                                    disabled={uploading || !uploadFile || !selectedTopicName.trim()}
                                    className="px-8 py-3 bg-amber-600 text-white font-black rounded-xl hover:bg-amber-700 transition-colors disabled:bg-amber-300 flex items-center gap-2"
                                >
                                    {uploading ? <Loader2 className="w-5 h-5 animate-spin" /> : <UploadCloud className="w-5 h-5" />}
                                    {uploading ? "Uploading..." : "Upload Material"}
                                </button>
                            </div>
                        </form>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>

      </main>
    </div>
  );
}
