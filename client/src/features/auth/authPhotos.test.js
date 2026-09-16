import assert from 'node:assert/strict';
import test from 'node:test';
import { authPhotos, chooseStartPhoto } from './authPhotos.js';

test('all five photographs can be selected on a first visit', () => {
  assert.equal(authPhotos.length, 5);
  assert.equal(new Set(authPhotos.map(photo => photo.src)).size, 5);
  for (let index = 0; index < 5; index++) {
    assert.equal(chooseStartPhoto(null, () => (index + 0.5) / 5), index);
  }
});

test('every previous opening photo is excluded; all other photos remain eligible', () => {
  for (const previous of authPhotos) {
    const choices = new Set();
    for (let index = 0; index < 4; index++) {
      const next = chooseStartPhoto(previous.src, () => (index + 0.5) / 4);
      assert.notEqual(authPhotos[next].src, previous.src);
      choices.add(next);
    }
    assert.equal(choices.size, 4);
  }
});

test('unknown or outdated stored photo falls back to the full set', () => {
  assert.equal(chooseStartPhoto('/removed.jpg', () => 0), 0);
  assert.equal(chooseStartPhoto('/removed.jpg', () => 0.9999), 4);
});
