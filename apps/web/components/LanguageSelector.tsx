'use client';

import React, { useState, useRef, useEffect } from 'react';
import {
  Globe,
  Check,
  ChevronDown,
  Search,
  Sparkles,
  Loader2,
  RotateCcw,
} from 'lucide-react';
import type { SupportedLanguage, PalmReadingReport } from '@palmora/shared-types';
import { SUPPORTED_LANGUAGES, translateReading, trackAnalyticsEvent } from '../lib/api';

interface LanguageSelectorProps {
  currentLanguageCode: string;
  report: PalmReadingReport;
  onLanguageChange: (translatedReport: PalmReadingReport, lang: SupportedLanguage) => void;
  isTranslating: boolean;
  setIsTranslating: (val: boolean) => void;
}

export default function LanguageSelector({
  currentLanguageCode,
  report,
  onLanguageChange,
  isTranslating,
  setIsTranslating,
}: LanguageSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [customLanguage, setCustomLanguage] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const activeLang =
    SUPPORTED_LANGUAGES.find((l) => l.code === currentLanguageCode) ||
    {
      code: currentLanguageCode,
      name: currentLanguageCode.toUpperCase(),
      native_name: currentLanguageCode,
      flag: '🌐',
      direction: currentLanguageCode === 'ar' ? 'rtl' : 'ltr',
    };

  const filteredLanguages = SUPPORTED_LANGUAGES.filter(
    (l) =>
      l.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      l.native_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      l.code.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleSelectLanguage = async (targetLang: SupportedLanguage) => {
    if (targetLang.code === currentLanguageCode && report.language === targetLang.code) {
      setIsOpen(false);
      return;
    }

    setIsOpen(false);
    setIsTranslating(true);

    try {
      trackAnalyticsEvent('reading_translation_requested', {
        reading_id: report.id,
        target_language: targetLang.code,
      });

      const translated = await translateReading({
        reading_id: report.id,
        target_language: targetLang.code,
        report,
      });

      onLanguageChange(translated, targetLang);
    } catch (err: any) {
      console.error('Translation error:', err);
      alert('Unable to complete translation. Please check connection and try again.');
    } finally {
      setIsTranslating(false);
    }
  };

  const handleCustomLanguageSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const rawLang = customLanguage.trim();
    const customLangObj: SupportedLanguage = {
      code: rawLang.toLowerCase().replace(/\s+/g, '_'),
      name: rawLang,
      native_name: rawLang,
      flag: '🌐',
      direction: 'ltr',
    };
    handleSelectLanguage(customLangObj);
    setCustomLanguage('');
  };

  return (
    <div className="relative inline-block text-left" ref={dropdownRef}>
      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        disabled={isTranslating}
        className="px-4 py-2.5 rounded-2xl text-xs font-semibold border border-[rgba(200,170,110,0.35)] bg-[#0B0E1B] hover:bg-[#12162A] text-white flex items-center gap-2.5 transition-all shadow-md group disabled:opacity-60"
        title="View reading in any language"
      >
        {isTranslating ? (
          <Loader2 className="w-4 h-4 text-[#C8AA6E] animate-spin" />
        ) : (
          <span className="text-base leading-none">{activeLang.flag || '🌐'}</span>
        )}

        <div className="flex flex-col text-left">
          <span className="text-[10px] text-[#C8AA6E] uppercase font-bold tracking-wider leading-none">
            Language
          </span>
          <span className="text-xs font-medium text-gray-200 group-hover:text-white leading-tight">
            {isTranslating ? 'Translating...' : `${activeLang.name} (${activeLang.native_name})`}
          </span>
        </div>

        <ChevronDown className={`w-3.5 h-3.5 text-gray-400 group-hover:text-[#C8AA6E] transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {/* Language Selection Popover */}
      {isOpen && (
        <div className="absolute right-0 sm:left-0 mt-2 w-72 sm:w-80 rounded-2xl bg-[#0B0E1B] border border-[rgba(200,170,110,0.3)] shadow-2xl z-50 p-3 flex flex-col gap-2.5 animate-in fade-in zoom-in-95 duration-150">
          {/* Header */}
          <div className="flex items-center justify-between pb-2 border-b border-gray-800 px-1">
            <span className="text-xs font-bold text-white flex items-center gap-1.5">
              <Globe className="w-3.5 h-3.5 text-[#C8AA6E]" />
              <span>Select Reading Language</span>
            </span>
            <span className="text-[10px] text-[#C8AA6E] font-medium">Any Language</span>
          </div>

          {/* Search Box */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search (e.g. Hindi, Spanish, 日本語)..."
              className="w-full pl-9 pr-3 py-1.5 rounded-xl bg-[#070913] border border-gray-800 text-xs text-gray-200 placeholder-gray-500 focus:outline-none focus:border-[#C8AA6E] transition-colors"
            />
          </div>

          {/* Language List */}
          <div className="max-h-60 overflow-y-auto flex flex-col gap-1 pr-1 custom-scrollbar">
            {filteredLanguages.map((lang) => {
              const isSelected = lang.code === currentLanguageCode;
              return (
                <button
                  key={lang.code}
                  onClick={() => handleSelectLanguage(lang)}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-left text-xs transition-colors ${
                    isSelected
                      ? 'bg-[#C8AA6E]/20 text-[#C8AA6E] font-bold border border-[#C8AA6E]/30'
                      : 'text-gray-300 hover:bg-[#12162A] hover:text-white'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <span className="text-base">{lang.flag || '🌐'}</span>
                    <div className="flex flex-col">
                      <span className="leading-tight">{lang.name}</span>
                      <span className="text-[10px] text-gray-400 leading-tight">{lang.native_name}</span>
                    </div>
                  </div>
                  {isSelected && <Check className="w-3.5 h-3.5 text-[#C8AA6E]" />}
                </button>
              );
            })}

            {filteredLanguages.length === 0 && (
              <div className="p-3 text-center text-xs text-gray-400">
                No matching language found in list.
              </div>
            )}
          </div>

          {/* Custom Language Input */}
          <form onSubmit={handleCustomLanguageSubmit} className="pt-2 border-t border-gray-800 flex gap-2">
            <input
              type="text"
              value={customLanguage}
              onChange={(e) => setCustomLanguage(e.target.value)}
              placeholder="Other language (e.g. Greek)..."
              className="flex-1 px-3 py-1.5 rounded-xl bg-[#070913] border border-gray-800 text-xs text-gray-200 placeholder-gray-500 focus:outline-none focus:border-[#C8AA6E]"
            />
            <button
              type="submit"
              disabled={!customLanguage.trim()}
              className="px-3 py-1.5 rounded-xl bg-[#C8AA6E] hover:bg-[#b5985d] text-black text-xs font-bold transition-colors disabled:opacity-40"
            >
              Translate
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
