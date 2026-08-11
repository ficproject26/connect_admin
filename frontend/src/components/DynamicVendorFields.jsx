import React, { useState, useEffect } from 'react';
import { Plus, X, Tag, Palette, Cpu, HardDrive, Layers, Check, Sliders, Info } from 'lucide-react';

// Preset options for common dynamic vendor fields
const PRESET_FIELD_CONFIGS = {
  size: {
    type: 'chips',
    options: ['S', 'M', 'L', 'XL', 'XXL', '3XL', '28', '30', '32', '34', '36', '38', '40', '42'],
    icon: Tag
  },
  color: {
    type: 'color',
    options: [
      { name: 'Black', hex: '#000000' },
      { name: 'White', hex: '#FFFFFF' },
      { name: 'Red', hex: '#EF4444' },
      { name: 'Blue', hex: '#3B82F6' },
      { name: 'Green', hex: '#22C55E' },
      { name: 'Yellow', hex: '#EAB308' },
      { name: 'Grey', hex: '#6B7280' },
      { name: 'Silver', hex: '#E5E7EB' },
      { name: 'Gold', hex: '#D97706' },
      { name: 'Navy', hex: '#1E3A8A' },
      { name: 'Purple', hex: '#A855F7' },
      { name: 'Pink', hex: '#EC4899' },
      { name: 'Orange', hex: '#F97316' }
    ],
    icon: Palette
  },
  ram: {
    type: 'chips',
    options: ['4 GB', '8 GB', '12 GB', '16 GB', '32 GB', '64 GB'],
    icon: Cpu
  },
  memory: {
    type: 'chips',
    options: ['4 GB', '8 GB', '12 GB', '16 GB', '32 GB', '64 GB'],
    icon: Cpu
  },
  storage: {
    type: 'chips',
    options: ['64 GB', '128 GB', '256 GB', '512 GB', '1 TB', '2 TB'],
    icon: HardDrive
  },
  processor: {
    type: 'select',
    options: ['Intel Core i3', 'Intel Core i5', 'Intel Core i7', 'Intel Core i9', 'AMD Ryzen 5', 'AMD Ryzen 7', 'Apple M1', 'Apple M2', 'Apple M3', 'Snapdragon 8 Gen 2'],
    icon: Cpu
  },
  prossoser: {
    type: 'select',
    options: ['Intel Core i3', 'Intel Core i5', 'Intel Core i7', 'Intel Core i9', 'AMD Ryzen 5', 'AMD Ryzen 7', 'Apple M1', 'Apple M2', 'Apple M3'],
    icon: Cpu
  },
  material: {
    type: 'select',
    options: ['Cotton', 'Polyester', 'Leather', 'Denim', 'Silk', 'Wool', 'Metal', 'Plastic', 'Wood', 'Glass', 'Stainless Steel'],
    icon: Layers
  }
};

/**
 * DynamicVendorFields
 * Rendered in Vendor Product Creation form whenever a Subcategory has requiredVendorFields.
 * Admin configuration is the single source of truth.
 */
export const DynamicVendorFields = ({ requiredVendorFields = [], values = {}, onChange }) => {
  const fields = Array.isArray(requiredVendorFields)
    ? requiredVendorFields.map(f => String(f).trim()).filter(Boolean)
    : (typeof requiredVendorFields === 'string'
        ? requiredVendorFields.split(',').map(s => s.trim()).filter(Boolean)
        : []);

  const [fieldValues, setFieldValues] = useState(values || {});
  const [customInputs, setCustomInputs] = useState({});
  const [showCustomInput, setShowCustomInput] = useState({});

  useEffect(() => {
    setFieldValues(values || {});
  }, [values]);

  if (!fields || fields.length === 0) return null;

  const updateFieldValue = (fieldName, newValue) => {
    const updated = { ...fieldValues, [fieldName]: newValue };
    setFieldValues(updated);
    if (onChange) onChange(updated);
  };

  const toggleMultiOption = (fieldName, optionVal) => {
    const current = Array.isArray(fieldValues[fieldName])
      ? fieldValues[fieldName]
      : (fieldValues[fieldName] ? [fieldValues[fieldName]] : []);
    
    let updated;
    if (current.includes(optionVal)) {
      updated = current.filter(v => v !== optionVal);
    } else {
      updated = [...current, optionVal];
    }
    updateFieldValue(fieldName, updated);
  };

  const handleAddCustomValue = (fieldName) => {
    const customVal = (customInputs[fieldName] || '').trim();
    if (!customVal) return;

    const current = Array.isArray(fieldValues[fieldName])
      ? fieldValues[fieldName]
      : (fieldValues[fieldName] ? [fieldValues[fieldName]] : []);
    
    if (!current.includes(customVal)) {
      updateFieldValue(fieldName, [...current, customVal]);
    }
    setCustomInputs({ ...customInputs, [fieldName]: '' });
    setShowCustomInput({ ...showCustomInput, [fieldName]: false });
  };

  return (
    <div className="bg-gradient-to-br from-indigo-50/70 via-purple-50/40 to-slate-50 dark:from-indigo-950/30 dark:via-purple-950/20 dark:to-slate-900 border border-indigo-200/80 dark:border-indigo-900/50 rounded-2xl p-5 space-y-4 shadow-sm animate-fade-in">
      <div className="flex items-center justify-between pb-3 border-b border-indigo-100 dark:border-indigo-900/40">
        <div className="flex items-center gap-2">
          <div className="p-2 bg-indigo-600 text-white rounded-xl shadow-xs">
            <Sliders className="w-4 h-4" />
          </div>
          <div>
            <h4 className="text-xs font-black text-slate-800 dark:text-slate-100 uppercase tracking-wider">
              Subcategory Required Vendor Fields
            </h4>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
              Configured by Admin for this Subcategory ({fields.length} dynamic field{fields.length > 1 ? 's' : ''})
            </p>
          </div>
        </div>
        <span className="text-[10px] font-extrabold uppercase px-2.5 py-1 rounded-full bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 border border-indigo-500/20">
          ⚡ Auto-Synced
        </span>
      </div>

      <div className="space-y-4">
        {fields.map((rawFieldName) => {
          const fieldKey = rawFieldName.toLowerCase();
          const preset = PRESET_FIELD_CONFIGS[fieldKey];
          const currentValue = fieldValues[rawFieldName] || '';
          const selectedList = Array.isArray(currentValue) ? currentValue : (currentValue ? [currentValue] : []);
          const Icon = preset?.icon || Tag;

          return (
            <div key={rawFieldName} className="bg-white dark:bg-slate-900 border border-slate-200/70 dark:border-slate-800 p-4 rounded-xl space-y-2.5 shadow-2xs">
              <div className="flex justify-between items-center">
                <label className="text-xs font-extrabold text-slate-700 dark:text-slate-200 flex items-center gap-1.5">
                  <Icon className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                  <span>{rawFieldName} *</span>
                </label>
                {selectedList.length > 0 && (
                  <span className="text-[10px] font-bold text-slate-400">
                    Selected: <strong className="text-indigo-600 dark:text-indigo-400">{selectedList.join(', ')}</strong>
                  </span>
                )}
              </div>

              {/* COLOR SWATCH FIELD */}
              {preset?.type === 'color' && (
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    {preset.options.map((c) => {
                      const isSelected = selectedList.includes(c.name);
                      return (
                        <button
                          key={c.name}
                          type="button"
                          onClick={() => toggleMultiOption(rawFieldName, c.name)}
                          className={`group relative flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer border ${
                            isSelected
                              ? 'bg-purple-600 text-white border-purple-600 shadow-xs scale-105'
                              : 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-purple-300'
                          }`}
                        >
                          <span
                            className="w-3.5 h-3.5 rounded-full border border-slate-300 dark:border-slate-600 shrink-0 shadow-2xs"
                            style={{ backgroundColor: c.hex }}
                          />
                          <span>{c.name}</span>
                          {isSelected && <Check className="w-3 h-3 text-white shrink-0" />}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* CHIPS FIELD (SIZE, RAM, STORAGE) */}
              {preset?.type === 'chips' && (
                <div className="flex flex-wrap items-center gap-2">
                  {preset.options.map((opt) => {
                    const isSelected = selectedList.includes(opt);
                    return (
                      <button
                        key={opt}
                        type="button"
                        onClick={() => toggleMultiOption(rawFieldName, opt)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer border flex items-center gap-1 ${
                          isSelected
                            ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs scale-105'
                            : 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-indigo-300'
                        }`}
                      >
                        <span>{opt}</span>
                        {isSelected && <Check className="w-3 h-3 text-white shrink-0" />}
                      </button>
                    );
                  })}
                </div>
              )}

              {/* SELECT FIELD (PROCESSOR, MATERIAL) */}
              {preset?.type === 'select' && (
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    {preset.options.map((opt) => {
                      const isSelected = selectedList.includes(opt);
                      return (
                        <button
                          key={opt}
                          type="button"
                          onClick={() => toggleMultiOption(rawFieldName, opt)}
                          className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer border flex items-center gap-1 ${
                            isSelected
                              ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                              : 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-indigo-300'
                          }`}
                        >
                          <span>{opt}</span>
                          {isSelected && <Check className="w-3 h-3 text-white shrink-0" />}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* GENERAL / UNLISTED FIELD (BRAND, MODEL, ETC.) */}
              {!preset && (
                <div className="space-y-2">
                  <input
                    type="text"
                    placeholder={`Enter ${rawFieldName} (e.g. Dell, HP, Samsung)...`}
                    value={typeof currentValue === 'string' ? currentValue : (selectedList[0] || '')}
                    onChange={(e) => updateFieldValue(rawFieldName, e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3.5 py-2 text-xs font-medium text-slate-800 dark:text-slate-200 focus:outline-none focus:border-indigo-500"
                  />
                </div>
              )}

              {/* CUSTOM VALUE INPUT FOR ANY FIELD */}
              <div className="pt-1 flex flex-wrap items-center gap-2">
                {showCustomInput[rawFieldName] ? (
                  <div className="flex items-center gap-1.5 w-full sm:w-auto">
                    <input
                      type="text"
                      placeholder={`Enter custom ${rawFieldName}...`}
                      value={customInputs[rawFieldName] || ''}
                      onChange={(e) => setCustomInputs({ ...customInputs, [rawFieldName]: e.target.value })}
                      onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddCustomValue(rawFieldName); } }}
                      className="bg-slate-50 dark:bg-slate-950 border border-indigo-300 dark:border-indigo-800 rounded-xl px-3 py-1 text-xs text-slate-800 dark:text-slate-200 focus:outline-none"
                      autoFocus
                    />
                    <button
                      type="button"
                      onClick={() => handleAddCustomValue(rawFieldName)}
                      className="px-3 py-1 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-extrabold rounded-xl transition cursor-pointer"
                    >
                      Add
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowCustomInput({ ...showCustomInput, [rawFieldName]: false })}
                      className="p-1 text-slate-400 hover:text-slate-600 cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setShowCustomInput({ ...showCustomInput, [rawFieldName]: true })}
                    className="text-[11px] font-bold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    <Plus className="w-3 h-3" /> Add Custom {rawFieldName} Option
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default DynamicVendorFields;
