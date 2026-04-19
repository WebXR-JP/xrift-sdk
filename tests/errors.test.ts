import { describe, it, expect } from 'vitest';
import {
  XriftSdkError,
  XriftApiError,
  XriftAuthError,
  XriftNetworkError,
} from '../src/errors.js';

describe('Error classes', () => {
  it('XriftSdkError', () => {
    const err = new XriftSdkError('test');
    expect(err).toBeInstanceOf(Error);
    expect(err).toBeInstanceOf(XriftSdkError);
    expect(err.name).toBe('XriftSdkError');
    expect(err.message).toBe('test');
  });

  it('XriftApiError', () => {
    const err = new XriftApiError('not found', 404, { detail: 'missing' });
    expect(err).toBeInstanceOf(XriftSdkError);
    expect(err).toBeInstanceOf(XriftApiError);
    expect(err.name).toBe('XriftApiError');
    expect(err.statusCode).toBe(404);
    expect(err.responseBody).toEqual({ detail: 'missing' });
  });

  it('XriftAuthError', () => {
    const err = new XriftAuthError();
    expect(err).toBeInstanceOf(XriftApiError);
    expect(err).toBeInstanceOf(XriftAuthError);
    expect(err.name).toBe('XriftAuthError');
    expect(err.statusCode).toBe(401);
    expect(err.message).toBe('Authentication failed');
  });

  it('XriftNetworkError', () => {
    const cause = new Error('ECONNREFUSED');
    const err = new XriftNetworkError('network down', cause);
    expect(err).toBeInstanceOf(XriftSdkError);
    expect(err.name).toBe('XriftNetworkError');
    expect(err.cause).toBe(cause);
  });
});
