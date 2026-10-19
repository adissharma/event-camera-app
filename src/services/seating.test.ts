import { mergeSeatingGuests, normaliseSeatingGuests, parseSeatingList } from './seating';

describe('normaliseSeatingGuests', () => {
  it('keeps name and seat, trimming whitespace', () => {
    expect(normaliseSeatingGuests([{ name: ' Alex ', seat: ' Table 4 ' }])).toEqual([
      { name: 'Alex', seat: 'Table 4' },
    ]);
  });

  it('folds a legacy table field into the seat location', () => {
    expect(normaliseSeatingGuests([
      { name: 'Sam', table: 'Table 1', seat: 'Seat 4' },
      { name: 'Jo', table: 'Table 2', seat: '' },
    ])).toEqual([
      { name: 'Sam', seat: 'Table 1, Seat 4' },
      { name: 'Jo', seat: 'Table 2' },
    ]);
  });

  it('drops unnamed rows and tolerates non-array input', () => {
    expect(normaliseSeatingGuests([{ name: '', seat: 'Table 1' }, null])).toEqual([]);
    expect(normaliseSeatingGuests(null)).toEqual([]);
  });
});

describe('parseSeatingList', () => {
  it('reads a pasted comma list, keeping everything after the name as the seat', () => {
    expect(parseSeatingList('Sam Lee, Table 3, Seat 4\nPriya Shah, Top table\n\nJo')).toEqual([
      { name: 'Sam Lee', seat: 'Table 3, Seat 4' },
      { name: 'Priya Shah', seat: 'Top table' },
      { name: 'Jo', seat: '' },
    ]);
  });

  it('uses a header row to pick the name and seat columns', () => {
    const csv = '﻿Email,Name,Table,Seat\r\nsam@x.com,Sam Lee,Table 3,4\r\n,"Ortiz, Samantha",Top table,';
    expect(parseSeatingList(csv)).toEqual([
      { name: 'Sam Lee', seat: 'Table 3, Seat 4' },
      { name: 'Ortiz, Samantha', seat: 'Top table' },
    ]);
  });

  it('labels bare numbers with their column header', () => {
    expect(parseSeatingList('Name,Table,Seat\nSam Lee,8,1\nJo,Top table,12b')).toEqual([
      { name: 'Sam Lee', seat: 'Table 8, Seat 1' },
      { name: 'Jo', seat: 'Top table, Seat 12b' },
    ]);
  });

  it('reads rows pasted from a spreadsheet as tab-separated', () => {
    expect(parseSeatingList('Name\tTable\nSam Lee\tTable 3')).toEqual([
      { name: 'Sam Lee', seat: 'Table 3' },
    ]);
  });
});

describe('mergeSeatingGuests', () => {
  it('adds new names and updates existing ones without duplicating', () => {
    const result = mergeSeatingGuests(
      [{ name: 'Sam Lee', seat: 'Table 1' }, { name: 'Jo', seat: 'Table 2' }],
      [{ name: 'sam lee', seat: 'Table 3' }, { name: 'Jo', seat: '' }, { name: 'Priya', seat: 'Top table' }],
    );
    expect(result).toEqual({
      guests: [
        { name: 'Sam Lee', seat: 'Table 3' },
        { name: 'Jo', seat: 'Table 2' },
        { name: 'Priya', seat: 'Top table' },
      ],
      added: 1,
      updated: 1,
    });
  });
});
