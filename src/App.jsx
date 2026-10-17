import React, { useState } from 'react';
import { Calendar, Tag, Check, Circle, FolderPlus, Clock } from 'lucide-react';

export default function App() {
  const [categories, setCategories] = useState([
    { id: '1', name: 'Daily Goals' },
    { id: '2', name: 'Regular Tasks' }
  ]);
  
  const [tasks, setTasks] = useState([
    { id: '1', text: 'Drink 2L of water', categoryId: '1', completed: true, deadline: '' },
    { id: '2', text: 'Review project files', categoryId: '2', completed: false, deadline: '2026-10-17T10:00' }
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
    
    const newCategory = { id: Date.now().toString(), name: newCategoryName };
    setCategories([...categories, newCategory]);
    setSelectedCategory(newCategory.id);
    setNewCategoryName('');
    setShowCategoryInput(false);
  };

  const toggleTask = (id) => {
    setTasks(tasks.map(t => t.id === id ? { ...t, completed: !t.completed } : t));
  };

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 font-sans p-6">
      <div className="max-w-2xl mx-auto space-y-10 mt-10">
        
        {/* Header */}
        <header>
          <h1 className="text-3xl font-light tracking-tight text-gray-800">Overview</h1>
          <p className="text-gray-500 mt-1">Let's get things done today.</p>
        </header>

        {/* Unified Add Task Section */}
        <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-200 transition-all">
          <input 
            type="text" 
            placeholder="What needs to be done?" 
            className="w-full text-lg outline-none placeholder-gray-300 mb-5 text-gray-800"
            value={newTaskText}
            onChange={(e) => setNewTaskText(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAddTask()}
          />
          
          <div className="flex items-center justify-between border-t border-gray-100 pt-4">
            <div className="flex flex-wrap items-center gap-3">
              
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
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm cursor-pointer transition-all ${
                    deadline 
                      ? 'bg-indigo-50/80 text-indigo-700 font-medium border border-indigo-200/60 shadow-xs' 
                      : 'text-gray-500 bg-gray-50 hover:bg-gray-100/80 border border-transparent'
                  }`}
                >
                  <Clock size={15} className={deadline ? 'text-indigo-600' : 'text-gray-400'} />
                  <span>{deadline ? new Date(deadline).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' }) : 'Set Deadline'}</span>
                </label>
                {deadline && (
                  <button 
                    type="button" 
                    onClick={() => setDeadline('')}
                    className="ml-1 text-gray-400 hover:text-rose-500 p-1 rounded-full hover:bg-gray-100 transition-colors"
                    title="Clear deadline"
                    aria-label="Clear deadline"
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
                   className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm text-gray-600 bg-gray-50 hover:bg-gray-100/80 transition-colors"
                 >
                   <Tag size={15} className="text-gray-400" />
                   <span>{categories.find(c => c.id === selectedCategory)?.name || 'Select Category'}</span>
                 </button>
                 {isCategoryOpen && (
                   <div className="absolute top-full left-0 mt-2 w-48 bg-white border border-gray-100 rounded-2xl shadow-xl p-1.5 z-30">
                     <div className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider px-2.5 py-1.5">
                       Select Folder
                     </div>
                     <div className="flex flex-col gap-0.5">
                       {categories.map(c => (
                         <button
                           key={c.id}
                           type="button"
                           onClick={() => {
                             setSelectedCategory(c.id);
                             setIsCategoryOpen(false);
                           }}
                           className={`flex items-center justify-between w-full px-2.5 py-1.5 rounded-xl text-sm text-left transition-colors ${
                             selectedCategory === c.id ? 'bg-indigo-50 text-indigo-600 font-medium' : 'text-gray-700 hover:bg-gray-50'
                           }`}
                         >
                           <span>{c.name}</span>
                           {selectedCategory === c.id && <Check size={14} className="text-indigo-600" />}
                         </button>
                       ))}
                     </div>
                   </div>
                 )}
              </div>

              {/* Create Category Button */}
              <button 
                 onClick={() => setShowCategoryInput(!showCategoryInput)}
                 className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm text-gray-500 hover:text-zinc-900 transition-colors"
              >
                 <FolderPlus size={16} />
                 New Category
              </button>

            </div>

            <button 
              onClick={handleAddTask}
              className="bg-zinc-900 hover:bg-zinc-800 text-white px-5 py-2 rounded-xl text-sm font-medium transition-colors shrink-0 ml-4"
            >
              Add Task
            </button>
          </div>
          
          {/* Inline Create Category Field */}
          {showCategoryInput && (
            <div className="mt-4 flex gap-2 items-center bg-gray-50 p-2.5 rounded-xl border border-gray-100 animate-in fade-in slide-in-from-top-2">
               <input 
                 autoFocus
                 className="flex-1 bg-transparent outline-none text-sm px-2 text-gray-800 placeholder-gray-400"
                 placeholder="Enter new category name..."
                 value={newCategoryName}
                 onChange={(e) => setNewCategoryName(e.target.value)}
                 onKeyDown={(e) => e.key === 'Enter' && handleAddCategory()}
               />
               <button onClick={() => setShowCategoryInput(false)} className="text-gray-400 text-sm hover:text-gray-600 px-3 py-1">Cancel</button>
               <button onClick={handleAddCategory} className="bg-white border border-gray-200 text-zinc-800 text-sm font-medium px-4 py-1.5 rounded-lg shadow-sm hover:bg-gray-50">Save</button>
            </div>
          )}
        </div>

        {/* Task Lists Grouped by Category */}
        <div className="space-y-10">
          {categories.map(category => {
             const categoryTasks = tasks.filter(t => t.categoryId === category.id);
             
             // Minimalist approach: only render categories that have tasks
             if (categoryTasks.length === 0) return null; 
             
             return (
               <div key={category.id}>
                  <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-4 pl-2">{category.name}</h2>
                  <div className="space-y-2">
                    {categoryTasks.map(task => (
                       <div key={task.id} className="flex items-start gap-4 p-4 bg-white rounded-2xl border border-gray-100 shadow-sm group hover:border-gray-200 transition-all">
                          <button onClick={() => toggleTask(task.id)} className="text-gray-300 hover:text-zinc-800 transition-colors mt-0.5">
                             {task.completed ? <Check className="text-zinc-800" size={20} /> : <Circle size={20} />}
                          </button>
                          
                          <div className="flex-1 flex flex-col">
                            <span className={`text-base ${task.completed ? 'text-gray-300 line-through' : 'text-gray-800'}`}>
                               {task.text}
                            </span>
                            
                            {task.deadline && (
                               <span className={`text-xs flex items-center gap-1.5 mt-1.5 ${task.completed ? 'text-gray-300' : 'text-orange-600/80'}`}>
                                  <Calendar size={13} />
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
            <div className="text-center py-12">
               <p className="text-gray-400 text-sm">Your schedule is clear. Add a task above.</p>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
