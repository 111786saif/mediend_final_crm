import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { prepareDistribution, OTHER_CATEGORY_SENTINEL } from './prepare-distribution'

describe('prepareDistribution', () => {
  it('merges duplicate categories case-insensitively', () => {
    const result = prepareDistribution([
      { category: 'Ophthalmology', count: 5 },
      { category: 'ophthalmology', count: 3 },
      { category: ' OPHTHALMOLOGY ', count: 2 },
    ])

    assert.equal(result.rows.length, 1)
    assert.equal(result.rows[0].category, 'Ophthalmology')
    assert.equal(result.rows[0].count, 10)
    assert.equal(result.metrics.categoryCount, 1)
  })

  it('merges orthopedic spelling variants into orthopaedics', () => {
    const result = prepareDistribution([
      { category: 'Orthopaedics', count: 10 },
      { category: 'Orthopedic', count: 4 },
    ])

    assert.equal(result.rows.length, 1)
    assert.equal(result.rows[0].category, 'Orthopaedics')
    assert.equal(result.rows[0].count, 14)
  })

  it('maps empty, dash, and numeric categories to uncategorized', () => {
    const result = prepareDistribution([
      { category: '', count: 2 },
      { category: '-', count: 1 },
      { category: '6', count: 3 },
      { category: 'Cosmetic', count: 5 },
    ])

    const uncategorized = result.rows.find((row) => row.category === 'Uncategorized')
    assert.ok(uncategorized)
    assert.equal(uncategorized.count, 6)
    assert.equal(result.metrics.totalCases, 11)
  })

  it('computes percent from the full dataset, not the truncated display rows', () => {
    const rows = Array.from({ length: 12 }, (_, index) => ({
      category: `Category ${index + 1}`,
      count: 100 - index,
    }))

    const result = prepareDistribution(rows)
    assert.equal(result.rows.length, 9)
    assert.match(result.rows[8].category, /^Other \(/)

    const displayedTotalPercent = result.rows.reduce((sum, row) => sum + row.percent, 0)
    assert.ok(Math.abs(displayedTotalPercent - 100) < 0.05)
    assert.equal(result.rows[0].percent, (100 / rows.reduce((sum, row) => sum + row.count, 0)) * 100)
  })

  it('does not create an other row when there are nine or fewer categories', () => {
    const result = prepareDistribution([
      { category: 'A', count: 10 },
      { category: 'B', count: 9 },
      { category: 'C', count: 8 },
      { category: 'D', count: 7 },
      { category: 'E', count: 6 },
      { category: 'F', count: 5 },
      { category: 'G', count: 4 },
      { category: 'H', count: 3 },
      { category: 'I', count: 2 },
    ])

    assert.equal(result.rows.length, 9)
    assert.ok(!result.rows.some((row) => row.category.startsWith('Other (')))
  })

  it('folds categories beyond the top eight into other', () => {
    const rows = Array.from({ length: 11 }, (_, index) => ({
      category: `Category ${index + 1}`,
      count: 20 - index,
    }))

    const result = prepareDistribution(rows)
    const other = result.rows.find((row) => row.clickCategory === OTHER_CATEGORY_SENTINEL)

    assert.ok(other)
    assert.equal(other.category, 'Other (3 categories)')
    assert.equal(other.count, 20 - 8 + 20 - 9 + 20 - 10)
  })

  it('sorts rows descending by count', () => {
    const result = prepareDistribution([
      { category: 'Beta', count: 2 },
      { category: 'Alpha', count: 10 },
      { category: 'Gamma', count: 5 },
    ])

    assert.deepEqual(
      result.rows.map((row) => row.category),
      ['Alpha', 'Gamma', 'Beta'],
    )
  })
})
