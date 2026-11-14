/**
 * Piezas chicas de la pantalla 3. Usan los componentes compartidos de src/ui
 * (Missing, PrototypeStamp, SourceChip) y suman Confidence y ModelRuleTag,
 * que son de F04: cuando F04 los tenga, mover estos dos a src/ui/.
 */
import React from 'react';
import {Missing as SharedMissing, PrototypeStamp as SharedStamp} from '../ui/Missing';
import {SourceChip as SharedSourceChip} from '../ui/SourceChip';
import type {ConfidenceLevel} from './types';

export const PrototypeStamp: React.FC = () => <SharedStamp />;

export const SourceChip: React.FC<{source: string}> = ({source}) => (source ? <SharedSourceChip source={source} /> : null);

export const Missing: React.FC<{children?: string}> = ({children}) => <SharedMissing what={children ?? ''} inline />;

export const ModelRuleTag: React.FC<{kind: 'model' | 'rule'}> = ({kind}) => (
  <span className={`fr-tag fr-tag--${kind}`}>{kind === 'model' ? 'Model' : 'Rule'}</span>
);

const CONF_LABEL: Record<ConfidenceLevel, string> = {high: 'High confidence', medium: 'Medium confidence', low: 'Low confidence'};

/** Confianza en palabras + 3 puntos (no depende solo del color) */
export const Confidence: React.FC<{level: ConfidenceLevel; reason?: string}> = ({level, reason}) => {
  const filled = level === 'high' ? 3 : level === 'medium' ? 2 : 1;
  return (
    <span className={`fr-conf fr-conf--${level}`}>
      <span className="fr-conf-dots" aria-hidden="true">
        {[0, 1, 2].map((i) => (
          <i key={i} className={i < filled ? 'on' : ''} />
        ))}
      </span>
      <b>{CONF_LABEL[level]}</b>
      {reason ? <span className="fr-conf-reason">{reason.replace(/^Low confidence:\s*/i, '')}</span> : null}
    </span>
  );
};
