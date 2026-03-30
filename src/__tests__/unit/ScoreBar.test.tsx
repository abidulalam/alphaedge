import React from 'react'
import { render, screen } from '@testing-library/react'
import ScoreBar from '@/components/ScoreBar'

describe('ScoreBar', () => {
  describe('label text', () => {
    it('shows "Wide" for score >= 80', () => {
      render(<ScoreBar lbl="Moat" score={85} />)
      expect(screen.getByText('Wide')).toBeInTheDocument()
    })

    it('shows "Moderate" for score 60–79', () => {
      render(<ScoreBar lbl="Moat" score={70} />)
      expect(screen.getByText('Moderate')).toBeInTheDocument()
    })

    it('shows "Moderate" at exactly 60', () => {
      render(<ScoreBar lbl="Moat" score={60} />)
      expect(screen.getByText('Moderate')).toBeInTheDocument()
    })

    it('shows "Narrow" for score below 60', () => {
      render(<ScoreBar lbl="Moat" score={50} />)
      expect(screen.getByText('Narrow')).toBeInTheDocument()
    })

    it('shows "Narrow" for score 0', () => {
      render(<ScoreBar lbl="Growth" score={0} />)
      expect(screen.getByText('Narrow')).toBeInTheDocument()
    })
  })

  describe('score display', () => {
    it('renders the numeric score', () => {
      render(<ScoreBar lbl="Growth" score={72} />)
      expect(screen.getByText('72')).toBeInTheDocument()
    })

    it('renders the label prop', () => {
      render(<ScoreBar lbl="Moat Score" score={60} />)
      expect(screen.getByText('Moat Score')).toBeInTheDocument()
    })
  })

  describe('progress bar width', () => {
    it('sets bar width to match score percentage', () => {
      const { container } = render(<ScoreBar lbl="Test" score={65} />)
      const bar = container.querySelector('[style*="width: 65%"]')
      expect(bar).toBeInTheDocument()
    })
  })
})
