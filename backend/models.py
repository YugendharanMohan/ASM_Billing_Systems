from sqlalchemy import Column, Integer, String, Float, ForeignKey, Date, Boolean, DateTime
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from database import Base

class Admin(Base):
    __tablename__ = "admins"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True, nullable=False)
    hashed_password = Column(String, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

class Worker(Base):
    __tablename__ = "workers"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    phone = Column(String, nullable=True)
    is_active = Column(Boolean, default=True)
    
    # Relationship to production records
    records = relationship("ProductionRecord", back_populates="worker", cascade="all, delete-orphan")

class Shed(Base):
    __tablename__ = "sheds"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, nullable=False) # e.g., "A", "B"
    
    # Relationship to looms
    looms = relationship("Loom", back_populates="shed", cascade="all, delete-orphan")

class Loom(Base):
    __tablename__ = "looms"

    id = Column(Integer, primary_key=True, index=True)
    loom_number = Column(String, nullable=False) # e.g., "1", "2"
    shed_id = Column(Integer, ForeignKey("sheds.id", ondelete="CASCADE"))

    shed = relationship("Shed", back_populates="looms")
    records = relationship("ProductionRecord", back_populates="loom", cascade="all, delete-orphan")

class ProductionRecord(Base):
    __tablename__ = "production_records"

    id = Column(Integer, primary_key=True, index=True)
    date = Column(Date, nullable=False)
    shift = Column(String, nullable=False) # "Day" or "Night"
    meters_produced = Column(Float, nullable=False)
    rate_per_meter = Column(Float, nullable=False)
    
    # Total Amount can be calculated here or in the database
    # In Postgres/Supabase, we usually use a Generated Column, 
    # but we define it here for Python access.
    total_amount = Column(Float, nullable=False)

    worker_id = Column(Integer, ForeignKey("workers.id", ondelete="CASCADE"))
    loom_id = Column(Integer, ForeignKey("looms.id", ondelete="CASCADE"))

    worker = relationship("Worker", back_populates="records")
    loom = relationship("Loom", back_populates="records")