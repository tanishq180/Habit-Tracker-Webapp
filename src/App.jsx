import React, { useState } from 'react';
import { Calendar, Tag, Check, Circle, FolderPlus, Clock, Plus } from 'lucide-react';

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
              <div className="relative group">
                <input 
                  type="datetime-local" 
                  className="absolute opacity-0 inset-0 w-full h-full cursor-pointer z-10"
                  onChange={(e) => setDeadline(e.target.value)}
                  value={deadline}
                />
                <button className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm transition-colors ${deadline ? 'bg-zinc-100 text-zinc-900' : 'text-gray-400 bg-gray-50 hover:bg-gray-100'}`}>
                  <Clock size={16} />
                  {deadline ? new Date(deadline).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' }) : 'Set Date & Time'}
                </button>
              </div>

              {/* Category Dropdown */}
              <div className="relative group">
                 <select 
                   className="absolute opacity-0 inset-0 w-full h-full cursor-pointer z-10"
                   value={selectedCategory}
                   onChange={(e) => setSelectedCategory(e.target.value)}
                 >
                   {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                 </select>
                 <button className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm text-gray-500 bg-gray-50 hover:bg-gray-100 transition-colors">
                   <Tag size={16} />
                   {categories.find(c => c.id === selectedCategory)?.name || 'Select Category'}
                 </button>
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
