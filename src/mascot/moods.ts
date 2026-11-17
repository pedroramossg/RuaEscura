import type { RouteResult } from '../types/campus';
import type { ExpressionId } from './bloub/expressions';
import type { StateId } from './bloub/states';

export interface RouteMascotMood {
  state: StateId;
  expression: ExpressionId;
  tremble: boolean;
  tone: 'safe' | 'caution' | 'danger';
  bubble: string;
  inkColor: string;
  notifColor: string;
}

/**
 * Computes the mascot's emotional state, expression, tremble flag, color accent,
 * and speech bubble copy based on the active route's illumination & dark warnings.
 */
export function getRouteMascotMood(
  route: RouteResult,
  originShort: string,
  destShort: string
): RouteMascotMood {
  if (route.hasDarkWarning || route.illuminationPercentage < 45) {
    return {
      state: 'alert',
      expression: 'effraye',
      tremble: true,
      tone: 'danger',
      bubble: `Brr! O trecho ${originShort} → ${destShort} está escuro (${route.illuminationPercentage}%). Prefira a rota iluminada!`,
      inkColor: '#EA580C',
      notifColor: '#EF4444',
    };
  }

  if (route.illuminationPercentage < 75) {
    return {
      state: 'thinking',
      expression: 'triste',
      tremble: false,
      tone: 'caution',
      bubble: `Atenção em ${originShort} → ${destShort}: iluminação moderada (${route.illuminationPercentage}%).`,
      inkColor: '#D97706',
      notifColor: '#F59E0B',
    };
  }

  return {
    state: 'play',
    expression: 'heureux',
    tremble: false,
    tone: 'safe',
    bubble: `Tudo claro de ${originShort} até ${destShort}! ${route.illuminationPercentage}% iluminada e segura.`,
    inkColor: '#2563EB',
    notifColor: '#10B981',
  };
}
