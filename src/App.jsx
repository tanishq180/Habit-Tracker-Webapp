import React, { useState } from 'react';
import { Tag, Check, FolderPlus, Clock } from 'lucide-react';

export default function App() {
  const [categories, setCategories] = useState([
    { id: '1', name: 'DAILY BOSS' },
    { id: '2', name: 'MAIN QUESTS' }
  ]);
  
  const [tasks, setTasks] = useState([
    { id: '1', text: 'Drink 2L of potion / water', categoryId: '1', completed: true, deadline: '' },
    { id: '2', text: 'Review pixel-art asset logs', categoryId: '2', completed: false, deadline: '2026-10-17T10:00' }
  ]);

  const [newTaskText, setNewTaskText] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('1');
  const [deadline, setDeadline] = useState('');
  const [isCategoryOpen, setIsCategoryOpen] = useState(false);
  
  const [showCategoryInput, setShowCategoryInput] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');

  const handleAddTask = () => {
    if (!newTaskText.trim()) return;
    
    setTasks([
      ...tasks, 
      {
        id: Date.now().toString(),
        text: newTaskText,
        categoryId: selectedCategory,
        completed: false,
        deadline: deadline
      }
    ]);
    
    setNewTaskText('');
    setDeadline('');
  };

  const handleAddCategory = () => {
    if (!newCategoryName.trim()) return;
    
    const newCategory = { id: Date.now().toString(), name: newCategoryName.toUpperCase() };
    setCategories([...categories, newCategory]);
    setSelectedCategory(newCategory.id);
    setNewCategoryName('');
    setShowCategoryInput(false);
  };

  const handleRemoveCategory = (catId, e) => {
    e.stopPropagation();
    setCategories(categories.filter(c => c.id !== catId));
    setTasks(tasks.map(t => t.categoryId === catId ? { ...t, categoryId: '' } : t));
    if (selectedCategory === catId) {
      setSelectedCategory(categories.find(c => c.id !== catId)?.id || '');
    }
  };

  const toggleTask = (id) => {
    setTasks(tasks.map(t => t.id === id ? { ...t, completed: !t.completed } : t));
  };

  const completedCount = tasks.filter(t => t.completed).length;

  return (
    <div className="min-h-screen p-6 text-white selection:bg-pink-500 selection:text-white">
      <div className="max-w-2xl mx-auto space-y-8 mt-6">
        
        {/* Retro 8-Bit Header */}
        <header className="flex items-center justify-between border-b-2 border-black pb-5">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-yellow-400 text-2xl animate-pulse">★</span>
              <h1 className="font-pixel text-2xl tracking-wide text-white drop-shadow-[2px_2px_0px_#000]">
                ORBIT<span className="text-pink-500 animate-ping">_</span>
              </h1>
            </div>
            <p className="font-pixel-sub text-cyan-400 text-xs mt-1 tracking-wider">[ 8-BIT QUEST & HABIT LOG ]</p>
          </div>

          <div className="flex items-center gap-2.5">
            <div className="pixel-border bg-[#140d2e] px-2.5 py-1.5 font-pixel text-[10px] text-green-400 flex items-center gap-1.5">
              <span>✅</span> CLEARED: {completedCount}
            </div>
            <div className="pixel-border bg-[#140d2e] px-2.5 py-1.5 font-pixel text-[10px] text-yellow-400 flex items-center gap-1.5">
              <span>⚡</span> ACTIVE: {tasks.length - completedCount}
            </div>
          </div>
        </header>

        {/* Unified Add Task / Quest Terminal */}
        <div className="pixel-border bg-[#140d2e] p-5 shadow-2xl">
          <div className="flex items-center gap-3 bg-[#090518] border-2 border-black p-3 mb-4">
            <span className="font-pixel text-green-400 text-sm">&gt;</span>
            <input 
              type="text" 
              placeholder="ENTER QUEST OR HABIT..." 
              className="w-full bg-transparent outline-none font-sans text-lg text-white placeholder-purple-400/50"
              value={newTaskText}
              onChange={(e) => setNewTaskText(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAddTask()}
            />
          </div>
          
          <div className="flex items-center justify-between border-t-2 border-dashed border-purple-900/60 pt-4">
            <div className="flex flex-wrap items-center gap-2.5">
              
              {/* Deadline Picker */}
              <div className="relative flex items-center">
                <input 
                  type="datetime-local" 
                  id="react-deadline-input"
                  className="sr-only"
                  onChange={(e) => setDeadline(e.target.value)}
                  value={deadline}
                />
                <label 
                  htmlFor="react-deadline-input"
                  className={`pixel-btn flex items-center gap-1.5 px-3 py-1.5 text-xs cursor-pointer font-pixel-sub ${
                    deadline 
                      ? 'bg-cyan-500 text-black font-bold' 
                      : 'bg-[#221645] text-purple-200 hover:bg-[#2b1c59]'
                  }`}
                >
                  <Clock size={13} />
                  <span>{deadline ? new Date(deadline).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' }) : 'DEADLINE'}</span>
                </label>
                {deadline && (
                  <button 
                    type="button" 
                    onClick={() => setDeadline('')}
                    className="ml-1 pixel-btn bg-rose-600 text-white px-2 py-0.5 text-xs font-pixel"
                    title="Clear deadline"
                  >
                    ×
                  </button>
                )}
              </div>

              {/* Custom Category Dropdown */}
              <div className="relative">
                 <button 
                   type="button"
                   onClick={() => setIsCategoryOpen(!isCategoryOpen)}
                   className="pixel-btn flex items-center gap-1.5 px-3 py-1.5 text-xs text-purple-200 bg-[#221645] hover:bg-[#2b1c59] font-pixel-sub"
                 >
                   <Tag size={13} className="text-yellow-400" />
                   <span>{categories.find(c => c.id === selectedCategory)?.name || 'CATEGORY'}</span>
                 </button>
                 {isCategoryOpen && (
                   <div className="absolute top-full left-0 mt-2 w-56 bg-[#1b103c] border-4 border-black p-2 z-30 shadow-2xl">
                     <div className="font-pixel text-[9px] text-cyan-400 tracking-wider px-2 py-1 border-b border-purple-800 mb-1">
                       SELECT PACK
                     </div>
                     <div className="flex flex-col gap-1">
                       {categories.map(c => (
                         <div
                           key={c.id}
                           onClick={() => {
                             setSelectedCategory(c.id);
                             setIsCategoryOpen(false);
                           }}
                           className={`flex items-center justify-between w-full px-2.5 py-1.5 text-xs font-pixel-sub text-left border border-transparent cursor-pointer ${
                             selectedCategory === c.id ? 'bg-pink-600 text-white border-black font-bold' : 'text-purple-200 hover:bg-[#281854]'
                           }`}
                         >
                           <span>{c.name}</span>
                           <div className="flex items-center gap-1.5">
                             {selectedCategory === c.id && <Check size={13} className="text-yellow-300" />}
                             <button
                               type="button"
                               onClick={(e) => handleRemoveCategory(c.id, e)}
                               className="text-purple-400 hover:text-rose-400 hover:bg-black/30 px-1 text-xs font-pixel"
                               title="Remove category"
                             >
                               ×
                             </button>
                           </div>
                         </div>
                       ))}
                     </div>
                   </div>
                 )}
              </div>

              {/* Create Category Button */}
              <button 
                 onClick={() => setShowCategoryInput(!showCategoryInput)}
                 className="pixel-btn flex items-center gap-1.5 px-3 py-1.5 text-xs text-purple-300 bg-[#221645] hover:bg-[#2b1c59] font-pixel-sub"
              >
                 <FolderPlus size={13} />
                 + PACK
              </button>

            </div>

            <button 
              onClick={handleAddTask}
              className="pixel-btn bg-pink-600 hover:bg-pink-500 text-white px-5 py-2 font-pixel text-xs tracking-wider shrink-0 ml-3"
            >
              + ADD QUEST
            </button>
          </div>
          
          {/* Inline Create Category Field */}
          {showCategoryInput && (
            <div className="mt-4 flex gap-2 items-center bg-[#0d0724] p-3 border-2 border-black">
               <input 
                 autoFocus
                 className="flex-1 bg-transparent outline-none text-xs font-pixel px-2 text-white placeholder-purple-500"
                 placeholder="ENTER PACK NAME..."
                 value={newCategoryName}
                 onChange={(e) => setNewCategoryName(e.target.value)}
                 onKeyDown={(e) => e.key === 'Enter' && handleAddCategory()}
               />
               <button onClick={() => setShowCategoryInput(false)} className="pixel-btn bg-[#221645] text-purple-300 text-[10px] font-pixel px-3 py-1">CANCEL</button>
               <button onClick={handleAddCategory} className="pixel-btn bg-green-500 text-black text-[10px] font-pixel font-bold px-3 py-1">SAVE</button>
            </div>
          )}
        </div>

        {/* Task Lists Grouped by Category */}
        <div className="space-y-8">
          {categories.map(category => {
             const categoryTasks = tasks.filter(t => t.categoryId === category.id);
             if (categoryTasks.length === 0) return null; 
             
             return (
               <div key={category.id} className="space-y-2.5">
                  <div className="flex items-center gap-2 border-b-2 border-purple-900/60 pb-1.5 px-1">
                    <span className="w-2.5 h-2.5 bg-cyan-400 border border-black inline-block"></span>
                    <h2 className="font-pixel text-xs text-cyan-400 tracking-wider">{category.name}</h2>
                    <span className="font-pixel-sub text-[11px] text-purple-400 ml-auto">[{categoryTasks.length}]</span>
                    <button
                      type="button"
                      onClick={(e) => handleRemoveCategory(category.id, e)}
                      className="pixel-btn bg-red-600/80 hover:bg-red-600 text-white px-1.5 py-0.5 text-[9px] font-pixel ml-1"
                      title="Remove pack"
                    >
                      ×
                    </button>
                  </div>
                  
                  <div className="space-y-2">
                    {categoryTasks.map(task => (
                       <div key={task.id} className={`pixel-border flex items-start gap-3.5 p-3.5 transition-all ${task.completed ? 'bg-[#100b24]/60 opacity-60' : 'bg-[#191038] hover:bg-[#201548]'}`}>
                          <button onClick={() => toggleTask(task.id)} className="text-purple-400 hover:text-green-400 transition-colors mt-0.5">
                             {task.completed ? (
                               <div className="w-5 h-5 bg-green-500 border border-black flex items-center justify-center text-black font-bold text-xs">✓</div>
                             ) : (
                               <div className="w-5 h-5 bg-[#090518] border-2 border-black"></div>
                             )}
                          </button>
                          
                          <div className="flex-1 flex flex-col">
                            <span className={`text-base font-medium ${task.completed ? 'text-purple-400 line-through' : 'text-white'}`}>
                               {task.text}
                            </span>
                            
                            {task.deadline && (
                               <span className={`font-pixel-sub text-xs flex items-center gap-1.5 mt-1.5 ${task.completed ? 'text-purple-500' : 'text-amber-400'}`}>
                                  <Clock size={12} />
                                  {new Date(task.deadline).toLocaleString([], { 
                                    weekday: 'short', 
                                    month: 'short', 
                                    day: 'numeric',
                                    hour: '2-digit', 
                                    minute: '2-digit' 
                                  })}
                               </span>
                            )}
                          </div>
                       </div>
                    ))}
                  </div>
               </div>
             )
          })}
          
          {tasks.length === 0 && (
            <div className="pixel-border bg-[#140d2e] text-center py-10">
               <p className="font-pixel text-xs text-yellow-400">STAGE CLEAR ★</p>
               <p className="font-pixel-sub text-xs text-purple-300 mt-2">No active quests. Enter a new quest above!</p>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
