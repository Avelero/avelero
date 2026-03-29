"use client";

import { Icons } from "@v1/ui/icons";
import { useState } from "react";

interface FaqItem {
  question: string;
  answer: string;
}

interface FaqBlockProps {
  title?: string;
  items: FaqItem[];
}

function FaqAccordionItem({ question, answer }: FaqItem) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="border-t border-border">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex w-full items-center justify-between py-4 text-left cursor-pointer"
      >
        <span className="text-body text-foreground">{question}</span>
        <Icons.ChevronDown
          size={16}
          className={`flex-shrink-0 ml-4 text-foreground transition-transform duration-200 ${
            isOpen ? "rotate-180" : ""
          }`}
        />
      </button>
      <div
        className={`grid transition-[grid-template-rows] duration-200 ease-out ${
          isOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
        }`}
      >
        <div className="overflow-hidden">
          <p className="pb-4 text-small text-muted-foreground">{answer}</p>
        </div>
      </div>
    </div>
  );
}

export function FaqBlock({ title = "Questions & Answers", items }: FaqBlockProps) {
  return (
    <div className="w-full py-[45px] sm:py-[62px]">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-8">
        <h4 className="text-h6 md:text-h5 text-foreground">{title}</h4>
        <div className="flex flex-col border-b border-border">
          {items.map((item) => (
            <FaqAccordionItem
              key={item.question}
              question={item.question}
              answer={item.answer}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
